import type { RecentlyPlayed } from "../Player/PlayerInterfaces";

const homePageContent = JSON.parse(localStorage.getItem("MusicPlayer-HomePage") ?? "{}") as HomePageContent;

interface HomePageContent {
    track?: string[],
    album?: string[],
    artist?: string[],
    albumartist?: string[],
    playlist?: string[]
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
    localStorage.setItem("MusicPlayer-HomePage", JSON.stringify(homePageContent));
    return index === -1;
}

/**
 * Equivalent of Array.splice(), but for the home page content object
 * @param type which card should be spliced
 * @param start the start position where the elements should be spliced
 * @param length the number of elements to splice
 * @param args elements to add in the array after the removed ones
 * @returns the elements that have been removed
 */
export function spliceHomePageContent(type: keyof HomePageContent, start: number, length?: number, ...args: string[]) {
    if (!homePageContent[type]) return [];
    const spliced = homePageContent[type].splice(start, length ?? homePageContent[type].length - start, ...(args ?? []));
    localStorage.setItem("MusicPlayer-HomePage", JSON.stringify(homePageContent));
    return spliced;
}