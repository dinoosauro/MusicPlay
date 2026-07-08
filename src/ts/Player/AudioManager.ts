import SleepTimer from "./SleepTimer";
import type { metadataDB, songsStatsDB } from "../Database/DatabaseInterfaces";
import GetAlbumArt from "../DataFetcher/GetAlbumArt";
import GetAlbumArtId from "../DataFetcher/GetAlbumArtId";
import GetAudioFile from "../DataFetcher/GetAudioFile";
import type { MetadataSource, MetadataSourceQueue, UpdateContentProps } from "./PlayerInterfaces";
import IndexedDatabase from "../Database/IndexedDatabase";
import Settings from "../Settings";


interface PlayAudioProps {
    file: File,
    metadata: MetadataSource,
    albumArt?: Blob | string,
    avoidPlayingAudio?: boolean,
}

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
 * The time the user has started music playback, since the track was either:
 * - previously paused;
 * - finished.
 */
let durationStart = Date.now();


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

const obj = {
    /**
     * The currently playing audio object.
     * Note that this object will automatically be replaced when it's time to play a new track. To add callbacks, see the `addToUpdateContent` function
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
     * Play an audio file. The passed file will replace the currently-playing audio, if available.
     */
    async playAudio({ file, metadata, avoidPlayingAudio, albumArt }: PlayAudioProps) {
        if (obj.audio) {
            obj.audio.pause();
            URL.revokeObjectURL(obj.audio.src);
        }
        obj.currentMetadata = metadata;
        obj.previouslyPlayedTracks.push(metadata);
        let newAudioInstance = true; // Tell the pop-up players that the track has changed
        obj.audio = new Audio(URL.createObjectURL(file));
        obj.audio.playbackRate = obj.audioContext.playbackRate;
        obj.audio.preservesPitch = Settings.playback.adjustPitchForPlaybackRate;
        obj.audio.volume = obj.audioContext.volume;
        obj.audio.muted = obj.audioContext.volume === 0; // Since Safari on iOS doesn't allow changing the volume property, we can use as a fallback the muted one.
        obj.audio.addEventListener("play", () => { // Update the start playback date for the stats
            durationStart = Date.now();
        })
        obj.audio.addEventListener("timeupdate", (e) => { // Update the value for the pop-up players
            obj.updateContent({
                currentTime: obj.audio?.currentTime,
                duration: obj.audio?.duration,
                audioPlaying: true,
                newAudioInstance,
            });
            newAudioInstance = false;
        });
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
        })
        obj.audio.addEventListener("ended", async () => {
            updateStats(metadata.trackId, Date.now() - durationStart, metadata.metadata.duration);
            durationStart = Date.now();
            obj.nextButton();
        });
        obj.audio.addEventListener("pause", () => {
            obj.updateContent({
                isPaused: true
            });
            updateStats(metadata.trackId, Date.now() - durationStart, metadata.metadata.duration);
        });
        obj.audio.addEventListener("play", () => obj.updateContent({
            isPaused: false
        }))
        !avoidPlayingAudio && obj.audio.play();
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
        })
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
        if (obj.audio && (obj.audio.currentTime > 5 || obj.audioContext.queuePosition === 0)) { // Play the track again
            obj.audio.currentTime = 0;
        } else {
            queueManager.playNewAudioFile(undefined, undefined, true);
        }
    },
    /**
     * Go to the next track
     */
    nextButton() {
        /**
         * If true, the sleep timer has ended, and therefore we should stop the track playback.
         * We'll still call the `playAudio` function with the new audio file, but we'll ask the script not to play the song.
         */
        const shouldStop = SleepTimer.timerArguments.isRunning && SleepTimer.timerArguments.remainingHours === 0 && SleepTimer.timerArguments.isRunning && SleepTimer.timerArguments.remainingMinutes === 0 && SleepTimer.timerArguments.isRunning && SleepTimer.timerArguments.remainingSeconds === 0;
        if (shouldStop) SleepTimer.timerArguments.isRunning = false;
        if (!shouldStop && obj.audioContext.certainNextQueue.length !== 0 && obj.audioContext.repeat !== "loopSingle") { // Loop of single track
            queueManager.playNewAudioFile();
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
                    queueManager.playNewAudioFile(undefined, shouldStop || undefined);
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
                    queueManager.playNewAudioFile(undefined, shouldStop || undefined);
                    break;
                }
                default: {
                    obj.audioContext.shuffle ? (obj.audioContext.queuePosition = queueManager.getShuffleNumber()) : (obj.audioContext.queuePosition = 0);
                    queueManager.playNewAudioFile(undefined, obj.audioContext.shuffle ? undefined : true);
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
        queueManager.playNewAudioFile();
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
     */
    playNewAudioFile: async (queuePosition = obj.audioContext.queuePosition, skipPlayback?: boolean, playPreviousTrack?: boolean) => {
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
        obj.playAudio({ file, metadata: objToRead, avoidPlayingAudio: skipPlayback, albumArt: albumArt ?? undefined });
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
        if (obj.audio) obj.audio.currentTime = forward ? Math.min(obj.audio.duration, obj.audio.currentTime + (Settings.mediaSession.enableCustomOffset ? Settings.mediaSession.customOffset : (e.seekOffset || 10))) : Math.max(0, obj.audio.currentTime - (Settings.mediaSession.enableCustomOffset ? Settings.mediaSession.customOffset : (e.seekOffset || 10)));
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
    if (obj.audio && typeof e.seekTime !== "undefined") obj.audio.currentTime = e.seekTime;
})


export default obj;