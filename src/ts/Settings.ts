import type { EqualizerInfo, EqualizerPreset } from "./Player/PlayerInterfaces";

let obj = {
    lyrics: {
        useLrcLibByDefault: false,
        useLrcLibIfLyricsArentSynced: false,
        informOfLrcLibUsage: true
    },
    mediaSession: {
        actionForNextPrevButtons: "next",
        actionForSeekButtons: "seek",
        enableCustomOffset: false,
        customOffset: 10
    },
    miniPlayer: {
        enableMiniMode: true,
        showAdvancedControls: false
    },
    playback: {
        adjustPitchForPlaybackRate: true,
        standardPlaybackRate: 1
    },
    cssColors: {} as {[key: string]: string},
    language: navigator.language.substring(0, 2) as string | undefined,
    customArtColors: ["#4a7856", "#4a6f78", "#524a78", "#784a6d", "#784a52", "#785f4a", "#78704a"],
    equalizer: [] as EqualizerInfo[],
    customEqPresets: [] as EqualizerPreset[],
    settingsComponentOptions: {
        showLessControlsInEqEasyMode: false,
        enableEasyModeInEqMode: true
    },
    crossfade: {
        seconds: 0,
        isExponential: true,
        exponential: -4
    }
}


const json = JSON.parse(localStorage.getItem("MusicPlayer-Settings") ?? "{}");
obj = UpdateJsonProperties(json, obj);
obj = UpdateStorage(obj, "MusicPlayer-Settings")

/**
 * Copy the properties of an Object from an object to another one
 * @param json the thing that has the value to update
 * @param update the thing that needs to be updated
 * @returns the updated object
 */
function UpdateJsonProperties(json: any, update: any) {
    // @ts-ignore
    for (let key in json) typeof json[key] === "object" && !Array.isArray(json[key]) ? UpdateJsonProperties(json[key], update[key]) : (typeof json[key] === "object" && Array.isArray(json[key])) || (typeof update !== "undefined") ? update[key] = json[key] : {};
    return update;
}


/**
 * Tracks all the changes made to an Object
 * @param obj the object that should be tracked
 * @param key the LocalStorage key where the new file will be saved
 * @param mainObj the "root" of the object. You should NOT put anything here, since it's used only by the UpdateStorage function while iterating nested objects.
 * @returns the Proxy of that object, that should be set as the new value of the Object
 */
function UpdateStorage(obj: any, key: string, mainObj?: any) {
    const proxy = new Proxy(obj, {
        set: (obj, prop, value) => {
            obj[prop] = value;
            localStorage.setItem(key, JSON.stringify(mainObj ?? proxy));
            return true;
        }
    });
    for (const item in proxy) { // If one of the children is an Object, let's set the proxy also to it
        if (typeof proxy[item] === "object" && !(proxy[item] instanceof Uint8Array) && !(proxy[item] instanceof Blob) && !(proxy[item] instanceof File)) proxy[item] = UpdateStorage(proxy[item], key, mainObj ?? proxy)
    }
    return proxy;
}

if (window.location.hash === "#restoreTheme") { // Delete the saved theme
    obj.cssColors = {};
    history.replaceState("", "", "./");
}
for (const prop in obj.cssColors) document.body.style.setProperty(`--${prop}`, obj.cssColors[prop]); // Update CSS styling

export default obj;