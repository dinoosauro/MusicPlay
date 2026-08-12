import IndexedDatabase from "../Database/IndexedDatabase";
import type { RecentlyPlayed } from "../Player/PlayerInterfaces";

let homePageContent = JSON.parse(localStorage.getItem("MusicPlayer-HomePage") ?? "{}") as HomePageContent;

interface HomePageContent {
    track?: string[],
    album?: string[],
    artist?: string[],
    albumartist?: string[],
    playlist?: string[]
}

/**
 * Update the homepage content by rereading the Local Storage entries
 */
export function refreshHomepageContent() {
    homePageContent = JSON.parse(localStorage.getItem("MusicPlayer-HomePage") ?? "{}");
}

/**
 * Get all the elements that should be displayed in the home page
 * @returns the list with the elements to display in the home page
 */
export function getHomePageContent() {
    return homePageContent
}

/**
 * Add an element to the home page
 * @returns if the element has been added (true) or removed (false)
 */
export function addHomePageContent({type, id}: RecentlyPlayed) {
    if (!homePageContent[type]) homePageContent[type] = [];
    const index = homePageContent[type].indexOf(id);
    if (index !== -1) {
        homePageContent[type].splice(index, 1);
    } else {
        homePageContent[type].push(id);
    }
    saveHomePageContent();
    return index === -1;
}

/**
 * Equivalent of Array.splice(), but for the home page content object
 * @param type which card should be spliced
 * @param start the start position where the elements should be spliced
 * @param length the number of elements to splice
 * @param skipSave if the edit shouldn't be saved on the user's storage (cloud or not)
 * @param args elements to add in the array after the removed ones
 * @returns the elements that have been removed
 */
export function spliceHomePageContent(type: keyof HomePageContent, start: number, length?: number, skipSave?: boolean, ...args: string[]) {
    if (!homePageContent[type]) return [];
    const spliced = homePageContent[type].splice(start, length ?? homePageContent[type].length - start, ...(args ?? []));
    if (!skipSave) saveHomePageContent();
    return spliced;
}

/**
 * Save the homepage content, both on cloud and on device
 */
export function saveHomePageContent() {
    localStorage.setItem("MusicPlayer-HomePage", JSON.stringify(homePageContent));
    IndexedDatabase.cloudHelper.driveSetWrapper({
        object: {
            id: "MusicPlayer-HomePage",
            data: homePageContent as any
        },
        request: "localStorageInfo"
    });
}