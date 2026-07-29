import type { RecentlyPlayed } from "../Player/PlayerInterfaces";
import Settings from "../Settings";

/**
 * Update the Recently Played object by adding an element to it
 * @param newItem the element to add in the recently played object
 */
export default function UpdateRecentlyPlayed(newItem: RecentlyPlayed) {
    const prevItems = JSON.parse(localStorage.getItem("MusicPlayer-RecentlyPlayed") ?? "[]") as RecentlyPlayed[];
    const currentIndex = prevItems.findIndex(i => i.id === newItem.id);
    if (currentIndex !== -1) prevItems.splice(currentIndex, 1); // Remove it, since we'll add it again at the start of the array
    if (prevItems.length > Settings.homepage.maximumRecentlyPlayed) prevItems.pop();
    prevItems.unshift(newItem);
    localStorage.setItem("MusicPlayer-RecentlyPlayed", JSON.stringify(prevItems));
}