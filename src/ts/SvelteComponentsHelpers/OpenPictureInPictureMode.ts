import { mount, unmount } from "svelte";
import PopupAudioPlayer from "../../lib/AudioPlayer/PopupAudioPlayer.svelte";

/**
 * Open the Pop-up Audio Player in Picture-in-Picture mode
 */
export default async function OpenPictureInPictureMode({albumArtDb, metadataDb}: {albumArtDb: IDBDatabase, metadataDb: IDBDatabase}) {
    if (!window.documentPictureInPicture) return;
    if (window.documentPictureInPicture.window) {
        window.documentPictureInPicture.window.close();
        return;
    }
    const doc = await window.documentPictureInPicture?.requestWindow({
        width: 400,
        height: 400,
    });
    for (const item of document.querySelectorAll("link[rel=stylesheet],style")) { // Copy all the stylesheets to the new window
        const node = item.cloneNode(true);
        doc?.document.head.append(node);
    }
    const div = document.createElement("div");
    const item = mount(PopupAudioPlayer, {
        props: { fullscreenCallback: () => { }, isPiPMode: true, albumArtDb, metadataDb },
        target: div
    })
    doc?.document.body.append(div);
    doc?.addEventListener("pagehide", () => unmount(item));
    setTimeout(() => doc?.window.dispatchEvent(new Event("resize")), 500);
}