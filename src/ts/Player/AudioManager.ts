import SleepTimer from "./SleepTimer";
import type { metadataDB, songsStatsDB } from "../Database/DatabaseInterfaces";
import GetAlbumArt from "../DataFetcher/GetAlbumArt";
import GetAlbumArtId from "../DataFetcher/GetAlbumArtId";
import GetAudioFile from "../DataFetcher/GetAudioFile";
import type { EqualizerInfo, MetadataSource, MetadataSourceQueue, UpdateContentProps } from "./PlayerInterfaces";
import IndexedDatabase from "../Database/IndexedDatabase";
import Settings from "../Settings";


interface PlayAudioProps {
    file: File,
    metadata: MetadataSource,
    albumArt?: Blob | string,
    avoidPlayingAudio?: boolean,
    isFromUserInteraction?: boolean,
}

/**
 * The AudioContext used to apply effects to the currently-playing audio file
 */
const audioContext = new AudioContext();
/**
 * A list of all the functions to call after an event is triggered by the audio player
 */
const updateContentObj: ((dataToUpdate: UpdateContentProps) => void)[] = [];

// List of databases used by the audio player
let songDb: IDBDatabase;
let albumArtDb: IDBDatabase;
let statsDb: IDBDatabase;
let metadataDb: IDBDatabase;



/**
 * Update the listening stats of the passed song
 * @param id the track ID whose stats will be updated
 * @param addMs the number of milliseconds tied to this reproduction
 * @param duration the length of the entire audio file
 */
async function updateStats(id: string, addMs: number, duration: number) {
    if (!statsDb) return;
    let prevOptions = await IndexedDatabase.get({
        db: statsDb,
        request: "songStats",
        query: id
    });
    let data = prevOptions?.data as songsStatsDB ?? { // Initialize the object if it's the first time the user listens to the song
        totalPlay: 0,
        totalMs: 0,
        activity: []
    };
    data.totalMs += addMs;
    data.totalPlay = data.totalMs / (duration * 1000);
    data.activity.push({
        date: Date.now(),
        duration: addMs
    });
    await IndexedDatabase.set({
        db: statsDb,
        request: "songStats",
        object: {
            id,
            data
        }
    });
}

/**
 * Get a BiquadFilter from an equalizer setting
 * @param info the EqualizerInfo usd for the new filter
 * @returns the filter to apply
 */
function getEqualizer(info: EqualizerInfo) {
    const eq = audioContext.createBiquadFilter();
    eq.type = info.type as BiquadFilterType; 
    const {center, q} = getEqValues(info.from, info.to);
    eq.frequency.value = center;
    eq.Q.value = q;
    eq.gain.value = info.db;
    return eq;
}
/**
 * Get values used for the BiquadFilter
 * @param min the start of the Hz of the filter
 * @param max the end of the Hz of the filter
 */
function getEqValues(min: number, max: number) {
    const center = Math.sqrt(min * max);
    const q = center / (max - min);
    return {center, q}
}

/**
 * If true, the Web Audio API should be used also for audio decoding. This is true only if the application is being run on iOS and the user wants the crossfade transition, since the only reason we use the Web Audio API for decoding is to circumvent the "only an Audio element can be played at a time" restriction
 */
const isFromiPhone = /(iPad|iPhone|iPod)/g.test(navigator.userAgent) && Settings.crossfade.seconds > 0;
console.log("Using Web Audio API for media decoding:", isFromiPhone);
/**
 * An array with all the events added to the HTMLAudioElement
 */
let addedFunctionEvents: (() => void)[] = [];

/**
 * If defined, the ID of the fade out effect interval (for crossfade)
 */
let gainIntervalId: number | undefined;
/**
 * An *unique* identifier of the currently-playing audio. This identifier changes every time a new track is played (so, when the function `playAudio()` is called)
 */
let trackProcessId = crypto.randomUUID();
const obj = {
    /**
     * The currently playing audio object.
     * Note that this object will automatically be replaced when it's time to play a new track. To add callbacks, see the `addToUpdateContent` function.
     * Note also that stats about the currently-playing item should NOT be taken from this object, but from the audioInformation class (since they would be unreliable if hte Web Audio API is used.)
     */
    audio: null as HTMLAudioElement | null,
    /**
     * Information around the currently-playing audio instance
     */
    audioContext: {
        /**
         * A list of all the files that have been added automatically **by the application** to the queue, for example if the user starts playing a song from the album viewer.
         * 
         * This list is never spliced, but instead the `queuePosition` number is increased/decreased when going backwards/forwards in the queue.
         */
        queue: [] as MetadataSourceQueue[],
        /**
         * A list of all the audio files that have been **manually added to the queue by the user**. 
         * 
         * Unlike the normal `queue`, this list is spliced when the track starts playing.
         */
        certainNextQueue: [] as MetadataSourceQueue[],
        /**
         * Repeat options
         */
        repeat: "none" as "none" | "loop" | "loopSingle",
        /**
         * If the next track from the normal `queue` (and not the certain one) should be random
         */
        shuffle: false,
        /**
         * The position of the currently-playing track in the `queue` object.
         * 
         * **Note:** Do not rely on this value to get metadata of the currently-playing music. If the user might have manually added some elements to the queue, the currently-playing track will be instead of the `certainNextQueue` object, and therefore this criteria can't be used to get information about the currently-playing track. See the `currentMetadata` property of the `AudioManager` for that.
         */
        queuePosition: 0,
        /**
         * Playback speed
         */
        playbackRate: Settings.playback.standardPlaybackRate,
        /**
         * The volume of the currently-playing track, from 0 to 1.
         */
        volume: 1,
        /**
         * **If the user is playing tracks from a playlist**, the ID of the selected playlist.
         */
        playlistId: null as null | string,
        /**
         * **If the user is playing tracks form a playlist**, the position in the playlist array of the track that has been clicked.
         * 
         * This entry means that the `queue` and the `originalQueue` arrays have had their entries moved of this value with `queue.unshift(...queue.splice(playlistStartPosition))`
         */
        playlistStartPosition: 0,
        /**
         * The queueId of the first item in the queue position.
         * This needs to be stored since the user can move the queue list in the "Queue" view of the fullscreen player, and we need to certainly know the ID of the first element. *It should now be useless since there's the `originalQueue` object, but if it ain't broke don't fix it*
         */
        queueIdStart: null as null | string,
        /**
         * All the items in the queue. The order of this array won't be changed, even if the user changes the queue position in the Queue view.
         */
        originalQueue: [] as MetadataSourceQueue[]
    },
    /**
     * A list of the metadata of all the tracks that have been played
     */
    previouslyPlayedTracks: [] as MetadataSource[],
    /**
     * Metadata of the currently-playing item
     */
    currentMetadata: undefined as MetadataSource | undefined,
    /**
     * The container for all the information that should be fetched from the HTMLAudioElement
     */
    audioInformation: {
        currentTime: 0,
        duration: 0,
        updateCurrentTime(seconds: number) {
            // If the Web Audio API is used, this function will be changed by the `playAudio` function
            if (!obj.audio) return;
            obj.audio.currentTime = seconds;
        }
    },
    /**
     * Play an audio file. The passed file will replace the currently-playing audio, if available.
     */
    async playAudio({ file, metadata, avoidPlayingAudio, albumArt, isFromUserInteraction = true }: PlayAudioProps) {
        // First, let's update the play operation ID, so that we're sure that no events will be triggered if the user has changed track. This might happen only in edge cases (ex: timeupdate event fired while changing track).
        const currentProcessId = crypto.randomUUID();
        trackProcessId = currentProcessId;
        if (obj.audio && !isFromiPhone) {
            if (isFromUserInteraction || Settings.crossfade.seconds === 0) obj.audio.pause();
            URL.revokeObjectURL(obj.audio.src);
        }
        /**
         * The time the user has started music playback, since the track was either:
         * - previously paused;
         * - finished.
         */
        let durationStart = Date.now();
        obj.currentMetadata = metadata;
        obj.previouslyPlayedTracks.push(metadata);
        /**
         * A list of the previously-added function events. These events must be deleted.
         */
        const prevAddedFunctionEvents = [...addedFunctionEvents];
        addedFunctionEvents = [];
        let newAudioInstance = true; // Tell the pop-up players that the track has changed
        if (isFromiPhone && !obj.audio) { // Create a new Audio element with the MediaStream used by the Web Audio API
            obj.audio = new Audio();
            obj.audioEffects.mediaStreamDestination = audioContext.createMediaStreamDestination();
            obj.audio.srcObject = obj.audioEffects.mediaStreamDestination.stream;
        }
        if (!isFromiPhone || !obj.audio) {
            obj.audio = new Audio(URL.createObjectURL(file));
        }
        /**
         * If true, the `ended` event (go to the next track) won't be fired.
         * This boolean should be set to `true` when both:
         * - The Web Audio API is being used also for metadata decoding;
         * - The track needs to be paused: the only way to do that is to stop the AudioSource, and this would trigger the `ended` event (even if the track isn't actually ended, but we only paused it)
         */
        let skipEndEvent = false;

        /**
         * ID of the current change playback start operation.
         * Used so that we can avoid starting the track multiple times (that would trigger an Exception)
         */
        let initMediaId = crypto.randomUUID();
        /**
         * Restart the playback of the current audio file. **Should be used only if the web Audio API is being used for decoding.**
         * @param position the start position of the audio (equivalent to `currentTime`)
         */
        async function initMediaPlayback(position: number) {
            if (trackProcessId !== currentProcessId) return; // Avoid running the same function multiple times if a start operation is ongoing.
            let tempId = crypto.randomUUID();
            initMediaId = tempId;
            try {
                skipEndEvent = true;
                if (obj.audioEffects.trackInfo instanceof AudioBufferSourceNode) obj.audioEffects.trackInfo?.stop(); // Added in a try/catch block since the track might have not been started
            } catch (ex) {
                console.warn(ex)
            }
            // Generate again the audioEffects used
            obj.audioEffects.trackInfo?.disconnect();
            obj.audioEffects.trackInfo = null;
            obj.audioEffects.connectAudioProcessing({});
            (obj.audioEffects.trackInfo as unknown as AudioBufferSourceNode).buffer = await audioContext.decodeAudioData(await file.arrayBuffer()); // We need to read again the File, since storing the ArrayBuffer before would throw an exception
            if (initMediaId === tempId) {
                (obj.audioEffects.trackInfo as unknown as AudioBufferSourceNode).start(0, position);
            }
        }

        if (isFromiPhone) { // The Web Audio API should be used. Let's change the `updateCurrentTime` function
            // Here we'll store an identifier of the currentTime change operation so that we can avoid changing a lot of times the track playback position (since it requires a lot of memory). We'll wait 50 ms from the last change order before changing the currentTime.
            let prevId = crypto.randomUUID();
            obj.audioInformation.updateCurrentTime = (seconds: number) => {
                let newId = crypto.randomUUID();
                prevId = newId;
                setTimeout(async () => {
                    if (newId !== prevId) return;
                    // The media playback should be regenerated before the currentTime since otherwise, if the time set is greater than the transition value, the next track (and not the current one) would start playing at the passed position.
                    await initMediaPlayback(seconds);
                    obj.audioInformation.currentTime = seconds;
                    // Update these variables so that the application will start counting again
                    isFirstTimeUpdate = true;
                    prevTime = 0;
                }, 50)
            };
        }
        if (isFromUserInteraction && obj.audioEffects.trackInfo !== null) { // User manually changed the track. So, no crossfade should be done. Let's clean up the currently-used AudioSourceNode (if it was created), since we'll need to regenerate it
            if (obj.audioEffects.trackInfo instanceof AudioBufferSourceNode) (obj.audioEffects.trackInfo as AudioBufferSourceNode)?.stop();
            (obj.audioEffects.trackInfo as AudioBufferSourceNode)?.disconnect();
        } 
        obj.audioEffects.trackInfo = null;
        if (obj.audioEffects.connectInfo.gain || obj.audioEffects.equalizer.equalizerObjects.length !== 0 || (Settings.crossfade.seconds > 0 && !isFromUserInteraction) || obj.audioEffects.connectInfo.panner || isFromiPhone) { // Effects should be applied: let's use the Web Audio API for this file
            obj.audioEffects.connectAudioProcessing({forceGain: Settings.crossfade.seconds > 0 && !isFromUserInteraction});
        }
        obj.audioInformation.duration = metadata.metadata.duration ?? 0;
        obj.audioInformation.currentTime = 0;
        obj.audio.playbackRate = obj.audioContext.playbackRate;
        obj.audio.preservesPitch = Settings.playback.adjustPitchForPlaybackRate;
        obj.audio.volume = obj.audioContext.volume;
        obj.audio.muted = obj.audioContext.volume === 0; // Since Safari on iOS doesn't allow changing the volume property, we can use as a fallback the muted one. Gain property still works.
        if (isFromiPhone && obj.audioEffects.trackInfo) { // Load the audio buffer to the Web Audio API
            (obj.audioEffects.trackInfo as AudioBufferSourceNode).buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
        }
        /**
         * If true, the crossfade of the new track (so the one passed to this function) has been completed.
         */
        let initialCrossfadeDone = false;
        const firstPlayEvent = () => { // Update the start playback date for the stats
            durationStart = Date.now();
            if (Settings.crossfade.seconds > 0 && !isFromUserInteraction && !initialCrossfadeDone) {
                initialCrossfadeDone = true;
                const outputGain = obj.audioEffects.gainValue;
                const gainObject = obj.audioEffects.gain;
                const startGain = 0.01;
                const durationMs = Math.max(Settings.crossfade.seconds * 1000, 20);
                const startTime = performance.now();
                gainObject.gain.value = startGain;
                if (typeof gainIntervalId === "undefined") { // Let's run this only if another gain operation isn't ongoing
                    gainIntervalId = setInterval(() => {
                        if (obj.currentMetadata?.trackId !== metadata.trackId) {
                            clearInterval(gainIntervalId);
                            gainObject.gain.value = outputGain;
                            gainIntervalId = undefined;
                            return;
                        }
                        if (Settings.crossfade.isExponential) {                            
                            const elapsed = performance.now() - startTime;
                            const progress = Math.min(elapsed / durationMs, 1);
                            const easedProgress = 1 - Math.exp(Settings.crossfade.exponential * progress);
                            gainObject.gain.value = startGain + (outputGain - startGain) * easedProgress;
                            if (progress >= 1) {
                                gainObject.gain.value = outputGain;
                                clearInterval(gainIntervalId);
                                gainIntervalId = undefined;
                            }
                        } else {
                            gainObject.gain.value += outputGain / ((Settings.crossfade.seconds * 1000) / 20);
                            if (gainObject.gain.value >= outputGain) {
                                gainObject.gain.value = outputGain;
                                clearInterval(gainIntervalId);
                                gainIntervalId = undefined;
                            }
                        }
                    }, 20)
                }
            }
        };
        // We'll use the same logic also for all other events: we'll remove the previously-added event (if available), then we'll add the new event to the Audio element, and finally we'll add it to the array of the currently-added items (so that we can remove it when the next audio will play)
        if (prevAddedFunctionEvents.length !== 0) obj.audio.removeEventListener("play", prevAddedFunctionEvents.shift() as () => void);
        trackProcessId === currentProcessId && obj.audio.addEventListener("play", firstPlayEvent);
        addedFunctionEvents.push(firstPlayEvent);
        /**
         * If the end crossfade has started, so if the song passed to this function is ending.
         */
        let isCrossfadeStarted = false;
        /**
         * The value of the `currentTime` property the last time the `timeupdate` event has been fired. **Used only when the Web Audio API is used for audio decoding.**
         */
        let prevTime = 0;
        /**
         * If true, the `obj.audio.currentTime` property won't be used to get the new currentTime. **Used only when the Web Audio API is used for audio decoding.**
         */
        let isFirstTimeUpdate = true;
        const timeUpdateFn = (e: Event) => { // Update the value for the pop-up players
            if (trackProcessId !== currentProcessId || isCrossfadeStarted) return; // There's a new track playing, we don't need to mix the two events
            obj.audioInformation.currentTime = !isFromiPhone ? obj.audio?.currentTime as number : obj.audioInformation.currentTime + ((isFirstTimeUpdate ? 0 : obj.audio?.currentTime as number) - prevTime); // If the HTMLAudioElement is being used for audio playback, we can just get the currentTime property. Otherwise, we'll need to get the passed time between the last time the `timeupdate` function was called (that can be seen from the `prevTime` variable) and now.
            isFirstTimeUpdate = false;
            prevTime = obj.audio?.currentTime ?? 0;
            if (isFromiPhone && obj.audioEffects.trackInfo instanceof AudioBufferSourceNode) { // Let's update the duration value. We need to update it there and not at the start since it might require a little bit of time to fetch the duration from the AudioBufferSourceNode
                obj.audioInformation.duration = (obj.audioEffects.trackInfo?.buffer?.duration ?? 0) === 0 ? obj.audioInformation.duration : (obj.audioEffects.trackInfo?.buffer?.duration ?? 0);
                if (obj.audioInformation.duration === Infinity || isNaN(obj.audioInformation.duration)) obj.audioInformation.duration = metadata.metadata.duration ?? 0;
            } else obj.audioInformation.duration = obj.audio?.duration ?? 0;
            obj.updateContent({
                currentTime: obj.audioInformation.currentTime,
                duration: obj.audioInformation.duration,
                audioPlaying: true,
                newAudioInstance,
            });
            isFromiPhone && navigator.mediaSession?.setPositionState && navigator.mediaSession.setPositionState({ // If the Web Audio API is being used for media playback, we'll need to manually tell the browser the progress of the current audio, so that it can also be displayed in the Control Center.
                duration: obj.audioInformation.duration,
                playbackRate: 1,
                position: Math.min(obj.audioInformation.currentTime, obj.audioInformation.duration)
            });
            if (!obj.audio) return;
            if (Settings.crossfade.seconds > 0 && (obj.audioInformation.duration - obj.audioInformation.currentTime) < Settings.crossfade.seconds && !isCrossfadeStarted && obj.audioInformation.duration !== 0 && !isNaN(obj.audioInformation.duration)) { // Time to run the fade out crossfade
                isCrossfadeStarted = true;
                /**
                 * The object with all the AudioEffects applied to the track to fade out.
                 * These effects are completely separated from the ones used by the next track, since otherwise we would have issues with the gain.
                 */
                let info = obj.audioEffects.connectAudioProcessing({createNewElements: true, forceGain: true}); // This creates completely new effects
                let currentElement = obj.audioEffects.trackInfo;
                if (!info) return;
                obj.nextButton(false); // Start playback of new track
                const startGain = info.gain.gain.value;
                const durationMs = Math.max(Settings.crossfade.seconds * 1000, 20);
                const startTime = performance.now();
                /**
                 * Stop the interval and clean up values
                 */
                function stopInterval() { 
                    if (!info) return;
                    info.gain.gain.value = 0;
                    clearInterval(interval);
                    if (currentElement !== null && currentElement !== undefined) {
                        if (currentElement instanceof AudioBufferSourceNode) currentElement.stop();
                        currentElement.disconnect();
                    }
                    info.gain.disconnect();
                    info.panner.disconnect();
                    info.eq.forEach(e => e.disconnect());
                    // @ts-ignore
                    currentElement = undefined;
                    info = undefined;
                }
                const interval = setInterval(() => {
                    if (!info) return;
                    if (Settings.crossfade.isExponential) {
                        const elapsed = performance.now() - startTime;
                        const progress = Math.min(elapsed / durationMs, 1);
                        const attenuation = Math.exp(Settings.crossfade.exponential * progress);
                        info.gain.gain.value = startGain * attenuation;
                        if (progress >= 1) {
                            stopInterval();
                        }
                    } else {
                        info.gain.gain.value -= startGain / ((Settings.crossfade.seconds * 1000) / 20);
                        if (info.gain.gain.value <= 0) {
                            stopInterval();
                        }
                    }
                }, 20)
            }
            newAudioInstance = false;
        };
        if (prevAddedFunctionEvents.length !== 0) obj.audio.removeEventListener("timeupdate", prevAddedFunctionEvents.shift() as () => void);
        trackProcessId === currentProcessId && obj.audio.addEventListener("timeupdate", timeUpdateFn);
        addedFunctionEvents.push(timeUpdateFn as () => void);
        if ((navigator.mediaSession.metadata?.artwork?.length ?? 0) !== 0) URL.revokeObjectURL(((navigator.mediaSession.metadata as MediaMetadata).artwork as MediaImage[])[0].src);
        if (typeof albumArt === "string") { // We need to create a new Object URL, since the pop-up players will automatically revoke it at the end of the track playback.
            const req = await fetch(albumArt);
            albumArt = await req.blob();
        }
        navigator.mediaSession.metadata = new MediaMetadata({ // Add track information to the control center
            album: metadata.metadata.album,
            artist: metadata.metadata.artist,
            artwork: albumArt ? [{ src: URL.createObjectURL(albumArt) }] : undefined,
            title: metadata.metadata.title
        });
        const endedFn = async () => {
            if (trackProcessId !== currentProcessId) return;
            if (skipEndEvent) {
                skipEndEvent = false;
                return;
            }
            updateStats(metadata.trackId, Date.now() - durationStart, metadata.metadata.duration);
            durationStart = Date.now();
            if (!isCrossfadeStarted) {
                if (obj.audioEffects.trackInfo instanceof AudioBufferSourceNode) (obj.audioEffects.trackInfo as AudioBufferSourceNode)?.stop();
                (obj.audioEffects.trackInfo as AudioBufferSourceNode)?.disconnect();
                obj.nextButton(false);
            }
        };
        if (prevAddedFunctionEvents.length !== 0) (isFromiPhone ? (obj.audioEffects.trackInfo as unknown as AudioBufferSourceNode) : obj.audio).removeEventListener("ended", prevAddedFunctionEvents.shift() as () => void);
        trackProcessId === currentProcessId && (isFromiPhone ? (obj.audioEffects.trackInfo as unknown as AudioBufferSourceNode) : obj.audio).addEventListener("ended", endedFn);
        addedFunctionEvents.push(endedFn);
        /**
         * If true, the track has been paused. This is only used from the second "play" event if the audio is being decoded by the Web Audio API, since it tells the application that we'll need to start again the audio playback
         */
        let fromPause = false;
        const pauseFn = () => {
            if (isCrossfadeStarted) return;
            if (isFromiPhone) skipEndEvent = true;
            fromPause = true;
            // Since the time has been paused, when the "timeupdate" is fired no difference should be added the first time
            prevTime = 0;
            isFirstTimeUpdate = true;
            obj.updateContent({
                isPaused: true
            });
            updateStats(metadata.trackId, Date.now() - durationStart, metadata.metadata.duration);
            if (isFromiPhone && obj.audioEffects.trackInfo instanceof AudioBufferSourceNode) obj.audioEffects.trackInfo.stop();
        };
        if (prevAddedFunctionEvents.length !== 0) obj.audio.removeEventListener("pause", prevAddedFunctionEvents.shift() as () => void);
        trackProcessId === currentProcessId && obj.audio.addEventListener("pause", pauseFn);
        addedFunctionEvents.push(pauseFn);
        const playFn = async () => {
            if (fromPause && isFromiPhone && obj.audioEffects.trackInfo instanceof AudioBufferSourceNode) {
                fromPause = false;
                initMediaPlayback(obj.audioInformation.currentTime);
            }
            obj.updateContent({isPaused: false})
        };
        if (prevAddedFunctionEvents.length !== 0) obj.audio.removeEventListener("play", prevAddedFunctionEvents.shift() as () => void);
        trackProcessId === currentProcessId && obj.audio.addEventListener("play", playFn);
        addedFunctionEvents.push(playFn);
        !avoidPlayingAudio && obj.audio.paused && obj.audio.play();
        !avoidPlayingAudio && isFromiPhone && (obj.audioEffects.trackInfo as unknown as AudioBufferSourceNode)?.start();
        // Send information about the newly-played track
        obj.updateContent({
            title: metadata.metadata.title,
            albumName: metadata.metadata.album,
            author: metadata.metadata.artist,
            isPaused: avoidPlayingAudio,
            currentTime: 0,
            duration: obj?.audio.duration,
            lyrics: (metadata.metadata.syncedLyrics.length !== 0 ? metadata.metadata.syncedLyrics : metadata.metadata.embeddedLyrics) ?? null,
            albumArt,
        });
        // This must run as the last thing, since it might trigger an Exception (the audio track might have not been started)
        if (avoidPlayingAudio && isFromiPhone) { 
            obj.audio.pause();
            pauseFn();
        }
    },
    /**
     * Information container for the Web Audio API
     */
    audioEffects: {
        /**
         * Pipe the audio resource to the Audio Source Node (`obj.audioEffects.trackInfo`) and connect the effects
         * @returns 
         */
        connectAudioProcessing({createNewElements, forceGain}: {
            /**
             * If true, instead of applying the effects stored in the `obj.audioEffects` object, new ones will be created with the same value.
             */
            createNewElements?: boolean, 
            /**
             * If true, the gain effect will always be added, even if it has been disabled by the user.
             */
            forceGain?: boolean
        }) {
            if (!obj.audio) return;
            if (!obj.audioEffects.trackInfo) obj.audioEffects.trackInfo = isFromiPhone ? audioContext.createBufferSource() : audioContext.createMediaElementSource(obj.audio);
            // Disconnect already-added effects to avoid duplicating them
            obj.audioEffects.trackInfo.disconnect();
            obj.audioEffects.gain.disconnect();
            obj.audioEffects.panner.disconnect();
            for (const item of obj.audioEffects.equalizer.equalizerObjects) item.disconnect();
            /**
             * The object that contains all the elements to add
             */
            const items = {
                panner: obj.audioEffects.panner,
                eq: obj.audioEffects.equalizer.equalizerObjects,
                gain: obj.audioEffects.gain
            }
            if (createNewElements) { // Duplicate the effects so that editing one effect doesn't edit the other.
                const newPanner = audioContext.createStereoPanner();
                newPanner.pan.value = items.panner.pan.value;
                items.panner = newPanner;
                const newGain = audioContext.createGain();
                newGain.gain.value = items.gain.gain.value;
                items.gain = newGain;
                items.eq = Settings.equalizer.map(i => getEqualizer(i));
            }
            /**
             * The previous node, so where the next node should be connected to.
             */
            let prevNode = (obj.audioEffects.trackInfo ?? obj.audioEffects.trackInfo) as {
                connect: (destinationNode: AudioNode) => void
            };
            if (obj.audioEffects.connectInfo.panner) {
                prevNode.connect(items.panner);
                prevNode = items.panner;
            }
            for (let i = 0; i < items.eq.length; i++) {
                prevNode.connect(items.eq[i]);
                prevNode = items.eq[i];
            } 
            if (obj.audioEffects.connectInfo.gain || forceGain) {
                prevNode.connect(items.gain);
                prevNode = items.gain;
            } 
            prevNode.connect(isFromiPhone ? obj.audioEffects.mediaStreamDestination as MediaStreamAudioDestinationNode : audioContext.destination);
            if (createNewElements) return items;
        },
        /**
         * If not nullish, the AudioSourceNode where the effects are being applied
         */
        trackInfo: null as null | MediaElementAudioSourceNode | AudioBufferSourceNode,
        /**
         * If not nullish, the MediaStreamDestination used as a source for the Audio element. **Used only when the Web Audio API is used for audio decoding.**
         */
        mediaStreamDestination: null as null | MediaStreamAudioDestinationNode,
        /**
         * The AudioContext created by the application
         */
        audioContext,
        /**
         * Gain effect: increase/decrease the decibels of the application
         */
        gain: audioContext.createGain(),
        /**
         * Value of the gain effect. Should be updated both here and in the `gain.gain.value` object.
         */
        gainValue: 1,
        equalizer: {
            /**
            * Get a BiquadFilter from an equalizer setting
            * @param info the EqualizerInfo usd for the new filter
            * @returns the filter to apply
            */
            getEqualizer,
            /**
            * Get values used for the BiquadFilter
            * @param min the start of the Hz of the filter
            * @param max the end of the Hz of the filter
            */
            getEqValues,
            /**
             * All the filters to apply to get the equalizer effect
             */
            equalizerObjects: Settings.equalizer.map(i => getEqualizer(i))
        },
        /**
         * Audio panner effect: regulate the amount of audio that exits from the left speaker or from the right speaker
         */
        panner: audioContext.createStereoPanner(),
        /**
         * The effects that should be connected
         */
        connectInfo: {
            gain: false,
            panner: false
        }
    },
    /**
     * Add a function that'll be called when something happens from the `AudioManager`
     * @param fn the function to call when there's an event fired from the `AudioManager`
     * @param remove if the function should be removed
     */
    addToUpdateContent(fn: (dataToUpdate: UpdateContentProps) => void, remove = false) {
        if (remove) {
            const index = updateContentObj.findIndex(i => i === fn);
            if (index !== -1) updateContentObj.splice(index, 1);
            return;
        }
        updateContentObj.push(fn);
    },
    /**
     * Send some content to the functions subscribed to the `AudioManager` events
     * @param dataToUpdate the content to send to the events
     */
    updateContent(dataToUpdate: UpdateContentProps) {
        for (const item of updateContentObj) item(dataToUpdate);
    },
    /**
     * Unlike what its name suggests, this function is used to update all the databases used by the AudioManager during the application lifecycle
     */
    updateSongDb(songDatabase: IDBDatabase, albumArtDatabase: IDBDatabase, songStatsDatabase: IDBDatabase, metadataDatabase: IDBDatabase) {
        songDb = songDatabase;
        albumArtDb = albumArtDatabase;
        statsDb = songStatsDatabase;
        metadataDb = metadataDatabase;
    },
    /**
     * Go to the previous track
     */
    prevButton() {
        if (obj.audio && (obj.audioInformation.currentTime > 5 || obj.audioContext.queuePosition === 0)) { // Play the track again
            obj.audioInformation.updateCurrentTime(0);
        } else {
            queueManager.playNewAudioFile(undefined, undefined, true);
        }
    },
    /**
     * Go to the next track
     * @param isFromUserInteraction if the next button has been pressed by the user (default: true), or if the application is going to the next track automatically (false)
     */
    nextButton(isFromUserInteraction = true) {
        /**
         * If true, the sleep timer has ended, and therefore we should stop the track playback.
         * We'll still call the `playAudio` function with the new audio file, but we'll ask the script not to play the song.
         */
        const shouldStop = SleepTimer.timerArguments.isRunning && SleepTimer.timerArguments.remainingHours === 0 && SleepTimer.timerArguments.isRunning && SleepTimer.timerArguments.remainingMinutes === 0 && SleepTimer.timerArguments.isRunning && SleepTimer.timerArguments.remainingSeconds === 0;
        if (shouldStop) SleepTimer.timerArguments.isRunning = false;
        if (!shouldStop && obj.audioContext.certainNextQueue.length !== 0 && obj.audioContext.repeat !== "loopSingle") { // Loop of single track
            queueManager.playNewAudioFile(undefined, undefined, undefined, isFromUserInteraction);
            return;
        }
        if (obj.audioContext.queuePosition !== (obj.audioContext.queue.length - 1)) { // There is at least one more item in the queue
            switch (obj.audioContext.repeat) {
                case "loopSingle": {
                    if (!shouldStop) queueManager.playAgain();
                    break;
                }
                default: {
                    obj.audioContext.shuffle ? (obj.audioContext.queuePosition = queueManager.getShuffleNumber()) : obj.audioContext.queuePosition++;
                    queueManager.playNewAudioFile(undefined, shouldStop || undefined, undefined, isFromUserInteraction);
                    break;
                }
            }
        } else { // Finished the queue automatically added by the application. 
            switch (obj.audioContext.repeat) {
                case "loopSingle": {
                    if (!shouldStop) queueManager.playAgain();
                    break;
                }
                case "loop": {
                    obj.audioContext.shuffle ? (obj.audioContext.queuePosition = queueManager.getShuffleNumber()) : (obj.audioContext.queuePosition = 0);
                    queueManager.playNewAudioFile(undefined, shouldStop || undefined, undefined, isFromUserInteraction);
                    break;
                }
                default: {
                    obj.audioContext.shuffle ? (obj.audioContext.queuePosition = queueManager.getShuffleNumber()) : (obj.audioContext.queuePosition = 0);
                    queueManager.playNewAudioFile(undefined, obj.audioContext.shuffle ? undefined : true, undefined, isFromUserInteraction);
                    break;
                }
            }
        }
    },
    /**
     * Play the passed item in the queue automatically added by the application.
     * @param queuePosition the position of the item in the queue that should be played
     */
    playQueuePosition(queuePosition: number) {
        obj.audioContext.queuePosition = queuePosition;
        queueManager.playNewAudioFile(undefined, undefined, undefined, true);
    }
}

const queueManager = {
    /**
     * Play again the same track
     */
    playAgain() {
        (obj.audio as HTMLAudioElement).currentTime = 0;
        obj.audio?.play();
    },
    /**
     * Play a new audio file either from the queue, or from the previously-played elements
     * @param queuePosition the position of the item in the queue that should be played. If not passed, the value from the `queuePosition` property of the `audioContext` nested object will be used. Note that this function will always gave precedence to the `certainNextQueue`, so the one where the user manually added the song
     * @param skipPlayback if true, the application won't start playing the audio
     * @param playPreviousTrack if true, the application will play the previous track. Therefore, the value passed in the `queuePosition` argument will be ignored.
     * @param isFromUserInteraction if the next button has been pressed by the user (true), or if the application is going to the next track automatically (false)
     */
    playNewAudioFile: async (queuePosition = obj.audioContext.queuePosition, skipPlayback?: boolean, playPreviousTrack?: boolean, isFromUserInteraction?: boolean) => {
        if (playPreviousTrack && obj.previouslyPlayedTracks.length < 2) return; // Since in the `previouslyPlayedTracks` object we add also the currently-playing element, if the length is set to "1" it means that there's nothing previously played
        /**
         * The metadata of the audio file that will be played
         */
        let objToRead = obj.audioContext.certainNextQueue.length === 0 ? obj.audioContext.queue[queuePosition] : obj.audioContext.certainNextQueue.splice(0, 1)[0];
        if (playPreviousTrack) { 
            // We need to get the last two elements of the `certainNextQueue` object: the second-last element will be the one we play, while the last is the item that is being currently played and that will be skipped (and so we need to add it in the `certainNextQueue`, so that the user can play it again after the new track finishes)
            const splicedItems = obj.previouslyPlayedTracks.splice(-2).map(i => {return {...i, queueId: crypto.randomUUID()}});
            objToRead = splicedItems[0];
            obj.audioContext.certainNextQueue.unshift(splicedItems[1]);
        }
        const file = await GetAudioFile({ songDb, songId: objToRead.trackId, metadataDb});
        const albumArt = await GetAlbumArt({
            db: albumArtDb, id: GetAlbumArtId({
                albumAuthor: objToRead.metadata.albumArtist,
                albumName: objToRead.metadata.album,
                year: objToRead.metadata.year
            }), name: objToRead.metadata.album
        })
        obj.playAudio({ file, metadata: objToRead, avoidPlayingAudio: skipPlayback, albumArt: albumArt ?? undefined, isFromUserInteraction });
    },
    /**
     * Get the number of the item in the `queue` to play.
     * @returns the number of the element to play
     */
    getShuffleNumber() {
        let num = obj.audioContext.queue.findIndex(i => i.trackId === obj.currentMetadata?.trackId);
        if (obj.audioContext.queue.length === 1) return 1;
        while (num === obj.audioContext.queuePosition || num === -1) num = Math.floor(Math.random() * obj.audioContext.queue.length);
        return num;
    }
}

/**
 * 
 * @param e the Event fired
 * @param seek if true, the application will change the `currentTime` property of the currently-playing audio. If false, the application will skip to the next/previous track
 * @param forward if true, the application will either increase the `currentTime` property, or will go to the next audio in the queue. If false, the application will either decrease the `currentTime` property, or will go to the previous audio in the queue.
 * @returns 
 */
function mediaSessionButtons(e: MediaSessionActionDetails, seek: boolean, forward: boolean) {
    if (seek) {
        if (obj.audio) obj.audioInformation.updateCurrentTime(forward ? Math.min(obj.audioInformation.duration, obj.audioInformation.currentTime + (Settings.mediaSession.enableCustomOffset ? Settings.mediaSession.customOffset : (e.seekOffset || 10))) : Math.max(0, obj.audioInformation.currentTime - (Settings.mediaSession.enableCustomOffset ? Settings.mediaSession.customOffset : (e.seekOffset || 10))));
        return;
    }
    if (forward) obj.nextButton(); else obj.prevButton();
}


// Setup MediaSession events

navigator.mediaSession.setActionHandler("pause", () => obj.audio?.pause());
navigator.mediaSession.setActionHandler("play", () => obj.audio?.play())
navigator.mediaSession.setActionHandler("nexttrack", (e) => {
    mediaSessionButtons(e, Settings.mediaSession.actionForNextPrevButtons === "seek", true);
});
navigator.mediaSession.setActionHandler("previoustrack", (e) => {
    mediaSessionButtons(e, Settings.mediaSession.actionForNextPrevButtons === "seek", false);
})
navigator.mediaSession.setActionHandler("seekbackward", (e) => {
    mediaSessionButtons(e, Settings.mediaSession.actionForSeekButtons === "seek", false);
});
navigator.mediaSession.setActionHandler("seekforward", (e) => {
    mediaSessionButtons(e, Settings.mediaSession.actionForSeekButtons === "seek", true);
});
navigator.mediaSession.setActionHandler("seekto", (e) => {
    if (obj.audio && typeof e.seekTime !== "undefined") obj.audioInformation.updateCurrentTime(e.seekTime);
})


export default obj;