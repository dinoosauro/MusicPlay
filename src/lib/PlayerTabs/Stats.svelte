<script lang="ts">
    import { mount, onMount, unmount } from "svelte";
    import type { DatabaseContainer, songsStatsDB } from "../../ts/Database/DatabaseInterfaces";
    import type { MetadataSource } from "../../ts/Player/PlayerInterfaces";
    import Card from "../Card.svelte";
    import GetAlbumArt from "../../ts/DataFetcher/GetAlbumArt";
    import GetAlbumArtId from "../../ts/DataFetcher/GetAlbumArtId";
    import { lang } from "../../ts/SvelteComponentsHelpers/Language";
    import AutoRevokeUrl from "../../ts/SvelteComponentsHelpers/AutoRevokeUrl";
    import { type ChartConfiguration, type ChartDataset } from "chart.js";
    import Settings from "../../ts/Settings";
    import ChartViewer from "./SingleItem/ChartViewer.svelte"
    import GetGroupingRegex from "../../ts/DataFetcher/GetGroupingRegex";
    import ArtistImageManager from "../../ts/DataFetcher/ArtistImageManager";
    import { chartOptions, getChartFromArtistStats, getDisplayedTime, getWeekAndMonthChartForArtistsAndAlbums, getWeekAndSongDatasetForAlbumSongs, weekDayLabels, type ArtistStats, type StatsDisplayItem } from "../../ts/SvelteComponentsHelpers/GetChartFromArtistStats";
    import {getIfDateShouldBeSkipped, GetStatsDisplayItem, SkipDate} from "../../ts/SvelteComponentsHelpers/GetStatsDisplayItem";
    import SongStats from "../Dialogs/SongStats.svelte";
    import ExportPodiumChart from "../Dialogs/ExportPodiumChart.svelte";
    import IconsManager from "../../ts/Icons/IconsManager";
    import GetIntervalBetweenDates from "../../ts/SvelteComponentsHelpers/GetIntervalBetweenDates";

    const {metadata, databases}: {
        metadata?: [string, MetadataSource[]][],
        databases: DatabaseContainer
    } = $props();

    /**
     * An array that contains the stats object for a song
     */
    let statObject = $state<StatsDisplayItem[]>([])
    /**
     * The interval of time used to fetch the stats data. If it's a number array, the date should be between `startTime[0]` and `startTime[1]`
     */
    let startTime = $state<"week" | "month" | "year" | "all" | number[]>("week");
    /**
     * If the user has requested to see all the top songs (in general; not of a single album)
     */
    let areTopSongsExpanded = $state(false);
    /**
     * If the user has requested to see all the top artists
     */
    let areTopArtistsExpanded = $state(false);
    /**
     * If the user has requested to see all the top albums (in general, not of a single artist)
     */
    let areTopAlbumsExpanded = $state(false);
    /**
     * If the user has requested to see all the top albums of a single artists
     */
    let areTopAlbumsOfArtistExpanded = $state(false);
    /**
     * If the user has requested to see all the top tracks of a single artist
     */
    let areTopTracksOfArtistExpanded = $state(false);
    /**
     * If the user has requested to see all the top tracks of an album
     */
    let areTopTracksOfAlbumExpanded = $state(false);
    /**
     * Infomration about the **days of the week** the user has listened music to
     */
    let weekDayMsPlayed = $state<{
        mostPlayedDay: string,
        mostPlayedMs: number,
        chart: ChartConfiguration
    } | undefined>();
    /**
     * Information about the **days** (not divided by any category) the user has listened music to
     */
    let generalMsPlayed = $state<{
        mostPlayedDay: string,
        mostPlayedMs: number
        chart: ChartConfiguration
    }>();
    /**
     * Stats divided by artist. A nested array, where the inner object is composed of [the name of the artist, information about the music listened by the user of that artist]
     */
    let artistsPlay = $state<[string, ArtistStats][] | undefined>();
    /**
     * Stats divided by album. A nested array, where the inner object is composed of [the name of the album, information about the music listened by the user of that album]
     */
    let albumsPlay = $state<[string, ArtistStats][] | undefined>();
    /**
     * The single entry of the `artistsPlay` object the user has selected. If it's not undefined, this means that the user wants to see the stats of a specific artist (for example, the top albums of that artist or their top tracks). 
     */
    let expandArtistView = $state<[string, ArtistStats] | undefined>();
    /**
     * An array that contains the [object with all the stats of that album, a boolean that indicates if the user has selected the album from the Artists card].
     * If not undefined, the user wants to see all the stats of that selected album.
     * Note that, if the boolean is true (so, if the user has selected the stats from the artists card), only the songs that contain that artist will be displayed. It's therefore important to specify that when displaying the stats.
     */
    let expandAlbumView = $state<[ArtistStats, boolean] | undefined>();
    /**
     * If not undefined, the information that should be passed to the dialog used to show the stats of a single track.
     * The dialog will automatically be created when this value is valid, and will be destroyed when it's undefined.
     */
    let singleTrackToShow = $state<StatsDisplayItem | undefined>();
    /**
    * Read all the stats from the database and get all the objects necessary to display them
    */
    function getStats() {
        // Initialize the variables
        artistsPlay = undefined;
        albumsPlay = undefined;
        expandArtistView = undefined;
        expandAlbumView = undefined;
        singleTrackToShow = undefined;
        /**
         * The output object that'll contain all the loaded stats
         */
        const statsObj: StatsDisplayItem[] = [];
        if (!metadata) return;
        const flatMetadata = metadata.map(i => i[1]).flat();
        const entriesList = databases.songStatsDb.transaction(["songStats"], "readonly").objectStore("songStats").getAll();
        entriesList.onsuccess = async () => {
            for (const entry of entriesList.result as {id: string, data: songsStatsDB}[]) {
                const songMetadata = flatMetadata.find(i => i.trackId === entry.id);
                if (!songMetadata) continue;
                statsObj.push(GetStatsDisplayItem({entry, startTime, songMetadata}));
            }
            statsObj.sort((a, b) => b.playedMs - a.playedMs); // Let's sort the statsObject so that the first item is the most played one
            statObject = statsObj;
            // Now let's calculate the first stats about the day of the week and the day in general
            /**
             * An array that contains the number of ms listened per day of week ([0] is monday, [1] is tuesday, and so on)
             */
            let weekDayCalc: number[] = Array(7).fill(0);
            /**
             * An object that contains as a key the Date value of a day (set to midnight), and as a value the milliseconds played 
             */
            let generalDayCalc: {[key: string]: number} = {};
            for (const item of statsObj) {
                for (let i = 0; i < item.data.msPlayedAtWeekDay.length; i++) weekDayCalc[i] += (item.data.msPlayedAtWeekDay[i] ?? 0);
                for (let i = (item.source.activity.length - 1); i >= 0; i--) {
                    const date = new Date(item.source.activity[i].date);
                    const whatShouldWeDo = getIfDateShouldBeSkipped(startTime, date, item.source.activity[i].date);
                    if (whatShouldWeDo === SkipDate.BREAK) break;
                    if (whatShouldWeDo === SkipDate.CONTINUE) continue;
                    date.setHours(0);
                    date.setMinutes(0);
                    date.setSeconds(0);
                    date.setUTCMilliseconds(0);
                    const key = date.valueOf().toString();
                    if (!generalDayCalc[key]) generalDayCalc[key] = 0;
                    generalDayCalc[key] += item.source.activity[i].duration;
                }
            }
            // Let's now find which was the most played day of the week
            let mostPlayedDay = 0;
            for (let i = 0; i < weekDayCalc.length; i++) {
                if (weekDayCalc[i] > weekDayCalc[mostPlayedDay]) mostPlayedDay = i;
            }
            const tempDate = new Date("December 1, 2025");
            tempDate.setHours(24 * (mostPlayedDay || 7)); // 0 is Sunday
            // @ts-ignore
            const chartObject: ChartConfiguration = {
                type: "bar",
                data: {
                    labels: weekDayLabels,
                    datasets: [{
                        data: weekDayCalc,
                        backgroundColor: Settings.customChartColors,
                    }],
                },
                options: chartOptions
            }
            weekDayMsPlayed = {
                mostPlayedDay: tempDate.toLocaleDateString(undefined, {weekday: "long"}),
                mostPlayedMs: weekDayCalc[mostPlayedDay],
                chart: chartObject
            }
            /**
             * Let's order the object that contains all the days with their playback so that the first item is the oldest playback date
             */
            let generalDateOrdered = Object.entries(generalDayCalc).sort((a, b) => +a[0] - +b[0]);
            let mostPlayedGeneralDay = 0;
            for (let i = 0; i < generalDateOrdered.length; i++) {
                if (generalDateOrdered[mostPlayedGeneralDay][1] < generalDateOrdered[i][1]) mostPlayedGeneralDay = i;
            }
            generalMsPlayed = {
                mostPlayedDay: new Date(+generalDateOrdered[mostPlayedGeneralDay][0]).toLocaleString(undefined, {weekday: "long", day: "numeric", month: "long", year: "numeric"}),
                mostPlayedMs: generalDateOrdered[mostPlayedGeneralDay][1],
                chart: {
                    type: "bar",
                    data: {
                        labels: generalDateOrdered.map(i => new Date(+i[0]).toLocaleDateString()),
                        datasets: [{
                            data: generalDateOrdered.map(i => i[1]),
                            backgroundColor: Settings.customChartColors
                        }]
                    },
                    options: chartOptions
                }
            }

            /**
             * An object that contains as a key the artist name, and as a value their stats
             */
            let artists: {[key: string]: ArtistStats} = {};
            /**
             * An object that contains as a key the album ID, and as a value their stats
             */
            let albums: {[key: string]: ArtistStats} = {};
            for (const stat of statsObj) {
                // Update the artist object
                for (const artist of stat.songMetadata.metadata.artist.split(GetGroupingRegex())) {
                    if (!artists[artist]) artists[artist] = {songs: [], totalMs: 0, albums: {}, sortedAlbums: []};
                    artists[artist].songs.push(stat);
                    artists[artist].totalMs += stat.playedMs;     
                    if (!artists[artist].weekPlays) artists[artist].weekPlays = Array(7).fill(0);
                    for (let i = 0; i < stat.data.msPlayedAtWeekDay.length; i++) artists[artist].weekPlays[i] += (stat.data.msPlayedAtWeekDay[i] ?? 0);
                    if (!artists[artist].albums[stat.songMetadata.metadata.album]) artists[artist].albums[stat.songMetadata.metadata.album] = {songs: [], totalMs: 0, albums: {}, sortedAlbums: []};
                    artists[artist].albums[stat.songMetadata.metadata.album].songs.push(stat);
                    artists[artist].albums[stat.songMetadata.metadata.album].totalMs += stat.playedMs;
                }
                // Update the album object
                const albumId = GetAlbumArtId({albumAuthor: stat.songMetadata.metadata.albumArtist, albumName: stat.songMetadata.metadata.album, year: stat.songMetadata.metadata.year});
                if (!albums[albumId]) albums[albumId] = {albums: {}, songs: [], totalMs: 0, sortedAlbums: []};
                albums[albumId].songs.push(stat);
                albums[albumId].totalMs += stat.playedMs;
            }
            for (const artist in artists) {
                artists[artist].sortedAlbums = Object.entries(artists[artist].albums).sort((a, b) => b[1].totalMs - a[1].totalMs);
            }
            artistsPlay = Object.entries(artists).sort((a, b) => b[1].totalMs - a[1].totalMs);
            albumsPlay = Object.entries(albums).sort((a, b) => b[1].totalMs - a[1].totalMs).map(i => [i[1].songs[0].songMetadata.metadata.album, i[1]]);
        }
    }

    onMount(() => {
        getStats();
    })

    /**
     * A map that permits to get all the HTMLElements which the application can scroll to
     */
    let registeredScrollItems = new Map<string, HTMLElement>([]);
    /**
     * Register an HTMLElement so that it can be scrollable. After it has been registered, the application will automatically scroll to it.
     * @param node the HTMLElement to register
     * @param id an identifier for that HTMLElement, so that it can be scrolled to later using the `scrollToRegisteredItem` function
     */
    function scrollToItem(node: HTMLElement, id: string) {
        registeredScrollItems.set(id, node);
        scrollToRegisteredItem(id);
        return  {
            destroy: () => registeredScrollItems.delete(id)
        }
    }
    /**
     * Scroll to the HTMLElement registed with the `scrollToItem` function
     * @param id the ID of the HTMLElement used when registering it.
     */
    function scrollToRegisteredItem(id: string) {
        const node = registeredScrollItems.get(id);
        if (node) window.scrollTo({top: window.scrollY + node.getBoundingClientRect().top - 10, behavior: "smooth"});
    }
    /**
     * Create the object necessary to show the stats of a single album. After calling this function, the Album card will automatically be created and scrolled to.
     * @param stat the stats object of that album
     * @param isFromArtist if the function is being called from the Artist card. In this case, the Album card will contain only information about the tracks in which the artist is included in, so we'll notify the user about that.
     */
    function ShowAlbumView(stat: ArtistStats, isFromArtist?: boolean) {
        const artistObject: {[key: string]: ArtistStats} = {};
        for (const song of stat.songs) artistObject[crypto.randomUUID()] = {
            songs: [song],
            totalMs: song.playedMs,
            albums: {},
            sortedAlbums: []
        }
        stat.chart = {
            perDayOfWeek: getWeekAndSongDatasetForAlbumSongs(stat, "weekday"),
            perSong: getWeekAndSongDatasetForAlbumSongs(stat, "song"),
            perMonth: startTime !== "week" && startTime !== "month" ? getChartFromArtistStats({albums: {[stat.songs[0].songMetadata.metadata.album]: stat}}, "month") : undefined,
            songsPerMonth: startTime !== "week" && startTime !== "month" ? getChartFromArtistStats({albums: artistObject}, "albumsPerMonth", true) : undefined,
            perYear: startTime !== "week" && startTime !== "month" && startTime !== "year" ? getChartFromArtistStats({albums: {[stat.songs[0].songMetadata.metadata.album]: stat}}, "year") : undefined,
            songsPlayedPerYear: startTime !== "week" && startTime !== "month" && startTime !== "year" ? getChartFromArtistStats({albums: artistObject}, "albumsPlayedPerYear", true) : undefined,
            perHour: getChartFromArtistStats({albums: {[stat.songs[0].songMetadata.metadata.album]: stat}}, "hour"),
            songsPlayedPerHour: getChartFromArtistStats({albums: artistObject}, "albumsPerHour", true),
        }
        scrollToRegisteredItem("album");
        expandAlbumView = [stat, !!isFromArtist];
    }
    /**
     * Get how many times a track has been played
     * @param msPlayed the milliseconds of playback time
     * @param songDuration the duration of the song, in seconds
     */
    function getHowManyTimes(msPlayed: number, songDuration: number) {
        const time = Math.round(msPlayed / 1000 / songDuration);
        return ` (~ ${time} ${lang(`time${time === 1 ? "" : "s"}`)})`
    }

    /**
     * Get the description for the podium entry
     * @param data information about the podium entry
     * @param showHowManyTimes if, along with other information, it should be displayed how many times the user has listened to that track
     */
    function getPodiumDescription(data: StatsDisplayItem | [string, ArtistStats], showHowManyTimes?: boolean) {
        return `${lang("Listened for")} ${getDisplayedTime(Array.isArray(data) ? data[1].totalMs : data.playedMs)}${showHowManyTimes ? ` ${getHowManyTimes(Array.isArray(data) ? data[1].totalMs : data.playedMs, Array.isArray(data) ? data[1].songs.reduce((a, b) => a + b.songMetadata.metadata.duration, 0) : data.songMetadata.metadata.duration)}` : ""}`;
    }
    /**
     * **Data group option:** which division is being used for the chart that shows all the time spent listening by music (with no division)
     */
    let musicPlaybackInNumbersChoice = $state("week");
    /**
     * **Data group option:** which division is being used for the chart that shows the top albums listened by the user of the selected artist
     */

    let artistAlbumPlayed = $state("selectedTimeInterval");
    /**
     * **Data group option:** which division is being used for the chart that shows the top songs of the selected artist
     */
    let artistSongPlayed = $state("selectedTimeInterval");
    /**
     * **Data group option:** which division is being used for the chart that shows all the time spent listening to the selected artist
     */
    let artistMsPlays = $state("week");
    /**
     * **Data group option:** which division is being used for the chart that shows all the time spent listening to the selected album
     */
    let albumMsPlays = $state("week");
    /**
     * **Data group option:** which division is being used for the chart that shows the top songs of the selected album
     */
    let albumSongPlays = $state("selectedTimeInterval");
    /**
     * **Data group option:** which division is being used for the chart that shows the top albums listened by the user (of all artists, no division done)
     */
    let topAlbumsPlayed = $state("week");
     /**
     * **Data group option:** which division is being used for the chart that shows the top artists listened by the user (of all songs, no division done)
     */
    let topArtistsPlayed = $state("week");
    /**
     * If the user should be able to pick a custom number
     */
    let showDateRange = $state(false);
    /**
     * The interval of time where the stats have been fetched
     */
    let dateInterval = $derived(GetIntervalBetweenDates(startTime));
    /**
     * How many albums should be displayed in the "Top albums listened by the user" (without any division) chart
     */
    let topAlbumNumber = $state(10);
    /**
     * How many artists should be displayed in the "Top artists listened by the user" (without any division) chart
     */
    let topArtistNumber = $state(10);
</script>

{#snippet Podium(data: StatsDisplayItem | [string, ArtistStats], position: 1 | 2 | 3, fetchAlbumArt?: "fetchalbum" | "no")}
    <div class="podiumPosition">
        {#await fetchAlbumArt === "no" ? new Promise<Blob>((res, rej) => rej()) : Array.isArray(data) ? fetchAlbumArt === "fetchalbum" ? GetAlbumArt({db: databases.albumArtDb, id: GetAlbumArtId({albumAuthor: data[1].songs[0].songMetadata.metadata.albumArtist, year: data[1].songs[0].songMetadata.metadata.year, albumName: data[1].songs[0].songMetadata.metadata.album})}): ArtistImageManager.fetchImage({author: data[0], artistImageDb: databases.artistImgDb}) : GetAlbumArt({db: databases.albumArtDb, id: GetAlbumArtId({albumAuthor: data.songMetadata.metadata.albumArtist, year: data.songMetadata.metadata.year, albumName: data.songMetadata.metadata.album})})}
        {:then blob}
            <img src={URL.createObjectURL(blob)} use:AutoRevokeUrl alt={lang("Album art")}>
        {/await}
        <div style="height: 5px;"></div>
        <div style={`height: ${position === 3 ? 90 : position === 2 ? 140 : 190}px; background-color: var(--${position === 3 ? "third" : position === 2 ? "second" : "first"}placebg)`} class="podium"></div>
    </div>
{/snippet}
{#snippet PodiumDescription(data: StatsDisplayItem | [string, ArtistStats], position: 1 | 2 | 3, artistName?: string, showHowManyTimes?: boolean)}
    <p style="text-align: center; max-width: 22%; width: 22%">
        <span>{Array.isArray(data) ? data[0] : data.songMetadata.metadata.title}</span><br>
        {#if !Array.isArray(data) || artistName}
            <span style="color: var(--secondtext)">{!Array.isArray(data) ? data.songMetadata.metadata.artist : artistName}</span><br>
        {/if}
        <span class="secondaryMetadata" style={`color: var(--${position === 1 ? "first" : position === 2 ? "second" : "third"}place)`}>{getPodiumDescription(data, showHowManyTimes)}</span>
    </p>
{/snippet}

{#snippet PodiumWrapper(
    /**
     * The stat list that should be used to create the podium. 
     * It's suggested not to slice the list, since the application might use more than the first three tracks when exporting the podium image
    */
    sourceObject: StatsDisplayItem[] | [string, ArtistStats][], 
    /**
     * Basically, a title for the podium, that is used when exporting the image
    */
    resourceType: string, 
    /**
     * Optional parameter. If `fetchalbum` is passed, the album art image will always be used, even if an `ArtistStats` object has been passed. If `no` is passed, no album art will be added
    */
    fetchAlbumArt?: "fetchalbum" | "no", 
    /**
     * If the application should show how many times the user has listened to that track/album/artist etc.
    */
    showHowManyTimes?: boolean)}
<div style="position: relative;">
<h4>{lang("Your podium")}:</h4>
<button class="emptyButton flex hcenter wcenter circularButton hoveredBtn" style="position: absolute; height: auto; right: 15px; top: 0px" onclick={() => {
    const div = document.createElement("div");
    const mounted = mount(ExportPodiumChart, {
        target: div,
        props: {
            podiumInfo: sourceObject.slice(0, 5).map(i => {return {
                metadata: Array.isArray(i) ? i[1].songs[0].songMetadata : i.songMetadata,
                firstLine: Array.isArray(i) ? i[0] : i.songMetadata.metadata.title,
                secondLine: !Array.isArray(i) ? i.songMetadata.metadata.artist : (fetchAlbumArt === "fetchalbum" && Array.isArray(sourceObject[2])) ? i[1].songs[0].songMetadata.metadata.albumArtist : undefined,
                thirdLine: getPodiumDescription(i, showHowManyTimes)
            }}),
            type: resourceType, 
            dateInterval,
            databases,
            closeFn: () => { // The dialog is appended to the body and not to the div, so we'll need to look the sibling of the current div
                if (div.nextSibling instanceof HTMLElement) {
                    div.nextSibling.classList.add("opacity");
                    // @ts-ignore
                    setTimeout(() => (div.nextSibling.style.opacity = "0"), 25);
                }
                setTimeout(() => {
                if (div.nextSibling instanceof HTMLElement) div.nextSibling.style.opacity = "1";
                    unmount(mounted);
                    div.remove();
                }, 250)
            }
        }
    });
    document.body.append(div);
    setTimeout(() => (div.style.opacity = "1"), 25);
}}>
    <img use:AutoRevokeUrl style="width: 24px; height: 24px; padding: 5px" src={IconsManager.getIconObjectUrl("shareios")} alt={lang("Export and/or share")}>
</button>
    <div class="flex wcenter gap" style="align-items: flex-end;">
        {@render Podium(sourceObject[2], 3, fetchAlbumArt)}
        {@render Podium(sourceObject[0], 1, fetchAlbumArt)}
        {@render Podium(sourceObject[1], 2, fetchAlbumArt)}
    </div>
    <div class="flex wcenter gap">
        {@render PodiumDescription(sourceObject[2], 3, fetchAlbumArt === "fetchalbum" && Array.isArray(sourceObject[2]) ? sourceObject[2][1].songs[0].songMetadata.metadata.albumArtist : undefined, showHowManyTimes)}
        {@render PodiumDescription(sourceObject[0], 1, fetchAlbumArt === "fetchalbum" && Array.isArray(sourceObject[0]) ? sourceObject[0][1].songs[0].songMetadata.metadata.albumArtist : undefined, showHowManyTimes)}
        {@render PodiumDescription(sourceObject[1], 2, fetchAlbumArt === "fetchalbum" && Array.isArray(sourceObject[1]) ? sourceObject[1][1].songs[0].songMetadata.metadata.albumArtist : undefined, showHowManyTimes)}
    </div>
</div>
{/snippet}

{#snippet StatCard(
    /**
     * The promise that'll return the image Blob with the album art or the artist image
    */
    promiseToWait: Promise<Blob>, 
    /**
    * The position in the array of the current element
    */
    i: number, 
    /**
     * First line of the card
    */
    firstTitle: string, 
    /**
     * Second line of the card
    */
    secondTitle?: string, 
    /**
     * Third line of the card
    */
    thirdTitle?: string, 
    /**
     * If the card should be a little bit brighter
    */
    isSecondCard?: boolean
    )}
    <Card border={i > 2 ? undefined : `border: 2px solid var(--${i === 0 ? "first" : i === 1 ? "second" : "third"}place)`} secondCard={isSecondCard}>
        <div class="flex hcenter gap maxWidth" style="height: 100%;">
            {#await promiseToWait}
            {:then img}
                <img style="width: 65px; height: 65px; min-width: 65px; min-height: 65px; border-radius: 12px" alt={lang("Album art")} src={URL.createObjectURL(img)} use:AutoRevokeUrl>
            {/await}
            <div style="width: 100%;">
                <span>{firstTitle}</span>
                {#if secondTitle}
                    <br>
                    <span class="secondaryMetadata" style="overflow-wrap: anywhere;">{secondTitle}</span>
                {/if}
                {#if thirdTitle}
                    <br>
                    <span class="secondaryMetadata" style={i > 2 ? undefined : `color: var(--${i === 0 ? "first" : i === 1 ? "second" : "third"}place)`}>{thirdTitle}</span>
                {/if}
            </div>
        </div>
    </Card>
{/snippet}


<h2>{lang("Stats of")} <select style="width: fit-content;" onchange={(e) => {
     const value = (e.target as HTMLInputElement).value;
     if (value === "week" || value === "month" || value === "year" || value === "all") {
        startTime = value;
        showDateRange = false;
     } else {
        showDateRange = true;
        startTime = [];
        return;
     }
        getStats();
    }}>
        <option value="week">{lang("this week")}</option>
        <option value="month">{lang("this month")}</option>
        <option value="year">{lang("this year")}</option>
        <option value="all">{lang("all time")}</option>
        <option value="custom">{lang("custom")}</option>
    </select>
    {#if showDateRange}
    {lang("from")}: <input style="width: fit-content;" type="datetime-local" onchange={(e) => {
        if (!Array.isArray(startTime)) startTime = [];
        startTime[0] = new Date((e.target as HTMLInputElement).value).getTime();
        if (typeof startTime[1] !== "undefined") getStats();
    }}>
    {lang("to")}: <input style="width: fit-content;" type="datetime-local" onchange={(e) => {
        if (!Array.isArray(startTime)) startTime = [];
        startTime[1] = new Date((e.target as HTMLInputElement).value).getTime();
        if (typeof startTime[0] !== "undefined") getStats();
    }}>
    {/if}
</h2>
{#if statObject.length === 0}
<p>{lang("Reading all the stats of your entire library, please wait a little")}.</p>
{:else}
    <p>{lang("You've listened")} {getDisplayedTime(statObject.reduce((a, b) => a + b.playedMs, 0))} {lang("of songs during this time range")}.</p>
    <div class="flex gap wcenter mainStatWrap" style="align-items: stretch">
        <Card secondCard={true}>
            <h3>{lang("Your top songs")}:</h3>
            <p>{lang("These have been your most listened songs for the selected time range")}.</p>
            {#if statObject.length > 2}
            <Card>
                {@render PodiumWrapper(statObject, lang("My top songs"), undefined, true)}
            </Card><br>
            {/if}
            <div class="flex gap wrap wcenter statWrap" style="align-items: stretch">
            {#each statObject as stat, i (stat.songMetadata.trackId)}
                {#if i < 5 || areTopSongsExpanded}
                    <button class="emptyButton" onclick={() => {
                        singleTrackToShow = stat;
                    }}>
                        {@render StatCard(
                            GetAlbumArt({db: databases.albumArtDb, id: GetAlbumArtId({albumAuthor: stat.songMetadata.metadata.albumArtist, year: stat.songMetadata.metadata.year, albumName: stat.songMetadata.metadata.album})}),
                            i,
                            stat.songMetadata.metadata.title,
                            `${stat.songMetadata.metadata.album} – ${stat.songMetadata.metadata.artist}`,
                            `${lang("Listened for")} ${getDisplayedTime(stat.playedMs)} ${getHowManyTimes(stat.playedMs, stat.songMetadata.metadata.duration)}`
                        )}
                    </button>
                {/if}
            {/each}
            {#if statObject.length > 5 && !areTopSongsExpanded}
                <button style="height: auto;" class="emptyButton maxWidth" onclick={() => (areTopSongsExpanded = true)}>
                    <u>{lang("Load all")}</u>
                </button>
            {/if}
            </div><br>
            <i>{lang("Click on the track's name to see the stats of that track")}.</i><br><br>
        </Card>
        {#if weekDayMsPlayed}
            <Card secondCard={true}>
                <h3>{lang("Your music playback, in numbers")}:</h3>
                {#if generalMsPlayed}
                <p>{lang("The day of the selected interval you've listened to music the most is")} {generalMsPlayed.mostPlayedDay}, {lang("with")} {getDisplayedTime(generalMsPlayed.mostPlayedMs)}.</p>
                {/if}
                <p>{lang("The day")} <u>{lang("of the week")}</u> {lang("you've listened to music the most is")} {weekDayMsPlayed.mostPlayedDay}, {lang("with")} {getDisplayedTime(weekDayMsPlayed.mostPlayedMs)}.</p>
                    <Card>
                        <h4 class="flex hcenter gap">{lang("Which")} <select style="background-color: var(--secondcard); width: fit-content;" bind:value={musicPlaybackInNumbersChoice}>
                            <option value="hour">{lang("hour of the day")}</option>
                            {#if generalMsPlayed}
                                <option value="daySingle">{lang("day")}</option>
                            {/if}
                            <option value="week">{lang("day of the week")}</option>
                            {#if startTime !== "week"}
                                <option value="day">{lang("day of the month")}</option>
                                {#if startTime !== "month"}
                                    <option value="month">{lang("month")}</option>
                                    {#if startTime !== "year"}
                                        <option value="year">{lang("year")}</option>
                                    {/if}
                                {/if}
                            {/if}
                        </select> {lang("have you listened to music the most?")}</h4>
                        <Card secondCard={true}>
                            <ChartViewer exportInfo={{
                                title: `${lang("Music playback divided by")} ${musicPlaybackInNumbersChoice === "day" ? lang("day of the month") : musicPlaybackInNumbersChoice === "week" ? lang("day of the week") : musicPlaybackInNumbersChoice === "daySingle" ? lang("day") : lang(musicPlaybackInNumbersChoice)}`,
                                dateInterval
                            }} chartObject={
                            musicPlaybackInNumbersChoice === "daySingle" ? generalMsPlayed?.chart as ChartConfiguration :
                            musicPlaybackInNumbersChoice === "hour" ? {
                                type: "bar",
                                data: {
                                    labels: Array(24).fill(0).map((i, v) => v),
                                    datasets: [{
                                        data: (() => {
                                            const data = Array(24).fill(0);
                                            for (const stat of statObject) {
                                                for (let i = 0; i < stat.data.msPlayedAtHour.length; i++) data[i] += (stat.data.msPlayedAtHour[i] ?? 0); 
                                            }
                                            return data;
                                        })(),
                                        backgroundColor: Settings.customChartColors
                                    }]
                                },
                                options: chartOptions
                            } as ChartConfiguration :
                            musicPlaybackInNumbersChoice === "week" ? weekDayMsPlayed.chart
                            : musicPlaybackInNumbersChoice === "day" ? {
                                type: "line",
                                data: {
                                    labels: Array(30).fill(0).map((i, v) => v+1),
                                    datasets: (() => {
                                        /**
                                         * A nested array: `outputNum[0]` contains the data for January; `outputNum[1]` contains the data for February, and so on.
                                         * Each month array is populated by the number of ms listened for each day of that month
                                         */
                                        const outputNum: number[][] = [];
                                        for (let i = 0; i < 12; i++) outputNum[i] = [];
                                        for (const stat of statObject) {
                                            for (let i = 0; i < stat.data.msPlayedAtDay.length; i++) {
                                                if (!stat.data.msPlayedAtDay[i]) continue;
                                                if (!outputNum[i]) outputNum[i] = [];
                                                for (let j = 0; j < stat.data.msPlayedAtDay[i].length; j++) {
                                                    if (!outputNum[i][j]) outputNum[i][j] = 0;
                                                    outputNum[i][j] += (stat.data.msPlayedAtDay[i][j] ?? 0);
                                                }
                                            }
                                        }
                                        /**
                                         * We need to remove the month where no listening has been done. 
                                         * So, we'll start by adding a reference to the month the array refers to (so, it'll be `[month, daysOfTheMonth[]][]`), and then we'll remove the empty values.
                                        */
                                        let outputObject: [number, number[]][] = [];
                                        for (let i = 0; i < outputNum.length; i++) {
                                            if (outputNum[i].length === 0) continue;
                                            outputObject.push([i, outputNum[i]]);
                                        }
                                        const output = outputObject.map((val, i) => {
                                            const date = new Date();
                                            date.setMonth(val[0]);
                                            return {
                                                label: date.toLocaleDateString(undefined, {month: "long"}),
                                                data: val[1],
                                                backgroundColor: Settings.customChartColors[i % Settings.customChartColors.length]
                                            }
                                        });
                                        return output;
                                    })()
                                },
                                options: chartOptions
                            }
                            : musicPlaybackInNumbersChoice === "month" ? 
                            {
                                type: "line",
                                data: (() => {
                                    const months = Array(12).fill(0);
                                    for (const song of statObject) {
                                        for (let i = 0; i < song.data.msPlayedAtMonth.length; i++) months[i] += (song.data.msPlayedAtMonth[i] ?? 0);
                                    }
                                    let outputLabel: string[] = [];
                                    let outputMonths: number[] = [];
                                    for (let i = 0; i < 12; i++) {
                                        if (months[i] === 0) continue;
                                        const date = new Date();
                                        date.setMonth(i);
                                        outputLabel.push(date.toLocaleDateString(undefined, {month: "long"}));
                                        outputMonths.push(months[i]);
                                    }
                                    return {
                                        labels: outputLabel,
                                        datasets: [{
                                            data: outputMonths,
                                            backgroundColor: Settings.customChartColors
                                        }]
                                    }
                                })(),
                                options: chartOptions
                        } : {
                                type: "bar",
                                data: (() => {
                                    /**
                                     * Object that has the album year as a key, and the ms listened in that year as a value
                                     */
                                    let output: {[key: string]: number} = {};
                                    for (const song of statObject) {
                                        for (const key in song.data.msPlayedAtYear) {
                                            if (!output[key]) output[key] = 0;
                                            output[key] += (song.data.msPlayedAtYear[key] ?? 0);
                                        }
                                    }
                                    return {
                                        labels: Object.keys(output),
                                        datasets: [{
                                            data: Object.values(output),
                                            backgroundColor: Settings.customChartColors
                                        }]
                                    }
                                })(),
                                options: chartOptions
                            }
                        }></ChartViewer>
                        </Card>
                    </Card>
            </Card>
        {/if}
        {#if artistsPlay}
        <div>
            <Card secondCard={true}>
                <h3>{lang("Your favorite artists")}:</h3>
                <p>{lang("Your most listened artist is")} {artistsPlay[0][0]}, {lang("with a total of")} {getDisplayedTime(artistsPlay[0][1].totalMs)}.</p>
                {#if artistsPlay.length > 2}
                    <Card>
                        {@render PodiumWrapper(artistsPlay, lang("My top artists"))}
                    </Card><br>
                {/if}
                <div class="flex gap wrap wcenter statWrap" style="align-items: stretch">
                    {#each artistsPlay as [name, stat], i (name)}
                        {#if i < 5 || areTopArtistsExpanded}
                            <button class="emptyButton" onclick={() => {
                                if (!stat.chart) {
                                    stat.chart = {
                                        perDayOfWeek: {
                                            type: "bar",
                                            data: {
                                                labels: weekDayLabels,
                                                datasets: [{
                                                    data: stat.weekPlays as number[],
                                                    backgroundColor: Settings.customChartColors
                                                }]
                                            },
                                            options: chartOptions
                                        },
                                        perAlbum: {
                                            type: "bar",
                                            data: {
                                                labels: Object.keys(stat.albums),
                                                datasets: [{
                                                    data: Object.values(stat.albums).map(i => i.totalMs),
                                                    backgroundColor: Settings.customChartColors
                                                }]
                                            },
                                            options: chartOptions
                                        },
                                        perMonth: startTime !== "week" && startTime !== "month" ? getChartFromArtistStats(stat, "month") : undefined,
                                        albumsPerMonth: startTime !== "week" && startTime !== "month" ? getChartFromArtistStats(stat, "albumsPerMonth") : undefined,
                                        songsPerMonth: startTime !== "week" && startTime !== "month" ? getChartFromArtistStats(stat, "songsPerMonth") : undefined,
                                        perYear: startTime !== "week" && startTime !== "month" && startTime !== "year" ? getChartFromArtistStats(stat, "year") : undefined,
                                        albumsPlayedPerYear: startTime !== "week" && startTime !== "month" && startTime !== "year" ? getChartFromArtistStats(stat, "albumsPlayedPerYear") : undefined,
                                        songsPlayedPerYear: startTime !== "week" && startTime !== "month" && startTime !== "year" ? getChartFromArtistStats(stat, "songsPlayedPerYear") : undefined,
                                        perHour: getChartFromArtistStats(stat, "hour"),
                                        albumsPlayedPerHour: getChartFromArtistStats(stat, "albumsPerHour"),
                                        songsPlayedPerHour: getChartFromArtistStats(stat, "songsPerHour"),
                                        perSong: getWeekAndSongDatasetForAlbumSongs(stat, "song"),
                                        perSongDayOfWeek: getWeekAndSongDatasetForAlbumSongs(stat, "weekday")
                                    }
                                }
                                scrollToRegisteredItem("artist");
                                expandArtistView = [name, stat];
                            }}>      
                                {@render StatCard(
                                    ArtistImageManager.fetchImage({author: name, artistImageDb: databases.artistImgDb}),
                                    i,
                                    name,
                                    `${lang("Most listened album")}: ${stat.sortedAlbums[0][0]} ${lang("with")} ${getDisplayedTime(stat.sortedAlbums[0][1].totalMs)}`,
                                    `${lang("Listened for")} ${getDisplayedTime(stat.totalMs)}`
                                )}        
                            </button>
                        {/if}
                    {/each}
                    {#if artistsPlay.length > 5 && !areTopArtistsExpanded}
                        <button style="height: auto;" class="emptyButton maxWidth" onclick={() => (areTopArtistsExpanded = true)}>
                            <u>{lang("Load all")}</u>
                        </button>
                    {/if}
                </div><br>
                <i>{lang("Click on the artist name above to see all the stats of that artist")}.</i><br><br>
                <Card>
                    <h4 class="flex hcenter gap">{lang("Your top")} <input type="number" bind:value={topArtistNumber} style="width: 30px; background-color: var(--secondcard)"> {lang("artists, divided by")} <select style="background-color: var(--secondcard); width: fit-content" bind:value={topArtistsPlayed}>
                        <option value="hours">{lang("hour of the day")}</option>
                        <option value="week">{lang("day of the week")}</option>
                        <option value="monthday">{lang("day of the month")}</option>
                        <option value="month">{lang("month")}</option>
                        <option value="year">{lang("year")}</option>
                    </select></h4>
                    <Card secondCard={true}>
                        <ChartViewer exportInfo={{
                                title: `${lang("Top")} ${topArtistNumber} ${lang("artists divided by")} ${topArtistsPlayed === "hours" ? lang("hour") : topArtistsPlayed === "monthday" ? lang("day of the month") : topArtistsPlayed === "week" ? lang("day of the week") : lang(topArtistsPlayed)}`,
                                dateInterval
                            }} chartObject={(() => {
                            const outputObj: {[key: string]: ArtistStats} = {};
                            for (let i = 0; i < Math.min(topArtistNumber, artistsPlay.length); i++) {
                                outputObj[artistsPlay[i][0]] = artistsPlay[i][1];
                            }
                            if (topArtistsPlayed === "week" || topArtistsPlayed === "monthday") return getWeekAndMonthChartForArtistsAndAlbums(outputObj, topArtistsPlayed === "week" ? "week" : "month")
                            return getChartFromArtistStats({albums: outputObj}, topArtistsPlayed === "month" ? "albumsPerMonth" : topArtistsPlayed === "hours" ? "hour" : "albumsPlayedPerYear");
                        })()}></ChartViewer>
                    </Card>
                </Card>
            </Card>
        </div>
        {/if}
        {#if albumsPlay}
        <Card secondCard={true}>
            <h3>{lang("Your favorite albums")}:</h3>
            <p>{lang("Your most listened album is")} {albumsPlay[0][0]} {lang("by")} {albumsPlay[0][1].songs[0].songMetadata.metadata.albumArtist ?? albumsPlay[0][1].songs[0].songMetadata.metadata.artist}, {lang("with a total of")} {getDisplayedTime(albumsPlay[0][1].totalMs)}.</p>
            {#if albumsPlay.length > 2}
                <Card>
                    {@render PodiumWrapper(albumsPlay, lang("My top albums"), "fetchalbum", true)}
                </Card><br>
            {/if}
            <div class="flex gap wrap wcenter statWrap" style="align-items: stretch;">
                {#each albumsPlay as [name, stat], i (GetAlbumArtId({albumAuthor: stat.songs[0].songMetadata.metadata.albumArtist, year: stat.songs[0].songMetadata.metadata.year, albumName: stat.songs[0].songMetadata.metadata.album}))}
                    {#if i < 5 || areTopAlbumsExpanded}
                        <button class="emptyButton" onclick={() => ShowAlbumView(stat)}>
                            {@render StatCard(
                                GetAlbumArt({db: databases.albumArtDb, id: GetAlbumArtId({albumAuthor: stat.songs[0].songMetadata.metadata.albumArtist, year: stat.songs[0].songMetadata.metadata.year, albumName: stat.songs[0].songMetadata.metadata.album})}),
                                i,
                                name,
                                stat.songs[0].songMetadata.metadata.albumArtist,
                                `${lang("Listened for")} ${getDisplayedTime(stat.totalMs)} ${getHowManyTimes(stat.totalMs, stat.songs.reduce((a, b) => a + b.songMetadata.metadata.duration, 0))}`
                            )}
                        </button>
                    {/if}
                {/each}
            {#if albumsPlay.length > 5 && !areTopAlbumsExpanded}
                <button style="height: auto;" class="emptyButton maxWidth" onclick={() => (areTopAlbumsExpanded = true)}>
                <u>{lang("Load all")}</u>
                </button>
            {/if}
            </div><br>
            <i>{lang("Click on the album name above to see all the stats of the songs in that album")}.</i><br><br>
            <Card>
                <h4 class="flex hcenter gap">{lang("Your top")} <input type="number" bind:value={topAlbumNumber} style="width: 30px; background-color: var(--secondcard)"> {lang("albums, divided by")} <select style="background-color: var(--secondcard); width: fit-content" bind:value={topAlbumsPlayed}>
                    <option value="hours">{lang("hour of the day")}</option>
                    <option value="week">{lang("day of the week")}</option>
                    <option value="monthday">{lang("day of the month")}</option>
                    <option value="month">{lang("month of the year")}</option>
                    <option value="year">{lang("year")}</option>
                </select></h4>
                <Card secondCard={true}>
                    <ChartViewer exportInfo={{
                            title: `${lang("Top")} ${topAlbumNumber} ${lang("albums divided by")} ${topAlbumsPlayed === "monthday" ? lang("day of the month") :  topAlbumsPlayed === "week" ? lang("day of the week") : lang(topAlbumsPlayed === "hours" ? "hour" : topAlbumsPlayed)}`,
                            dateInterval
                        }} chartObject={(() => {
                        const outputObj: {[key: string]: ArtistStats} = {};
                        for (let i = 0; i < Math.min(topAlbumNumber, albumsPlay.length); i++) {
                            outputObj[albumsPlay[i][0]] = albumsPlay[i][1];
                        }
                        if (topAlbumsPlayed === "week" || topAlbumsPlayed === "monthday") return getWeekAndMonthChartForArtistsAndAlbums(outputObj, topAlbumsPlayed === "week" ? "week" : "month")
                        return getChartFromArtistStats({albums: outputObj}, topAlbumsPlayed === "month" ? "albumsPerMonth" : topAlbumsPlayed === "hours" ? "hour" : "albumsPlayedPerYear");
                    })()}></ChartViewer>
                </Card>
            </Card>
        </Card>
        {/if}
        {#if expandArtistView}
        <div use:scrollToItem={"artist"}>
            <Card secondCard={true}>
                <h3>{lang("Stats about")} {expandArtistView[0]}</h3>
                <Card>
                    <h4>{lang("Most listened albums")}:</h4>
                    {#if expandArtistView[1].sortedAlbums.length > 2}
                        <Card secondCard={true}>
                            {@render PodiumWrapper(expandArtistView[1].sortedAlbums, `${lang("My top albums of")} ${expandArtistView[0]}`, "fetchalbum")}
                        </Card>
                    {/if}<br>
                    <div class="flex gap wrap wcenter statWrap" style="align-items: stretch">
                        {#each expandArtistView[1].sortedAlbums as [name, stat], i (name)}
                            {#if i < 5 || areTopAlbumsOfArtistExpanded}
                                <button class="emptyButton" onclick={() => ShowAlbumView(stat, true)}>
                                    {@render StatCard(
                                        GetAlbumArt({db: databases.albumArtDb, id: GetAlbumArtId({albumAuthor: stat.songs[0].songMetadata.metadata.albumArtist, year: stat.songs[0].songMetadata.metadata.year, albumName: stat.songs[0].songMetadata.metadata.album})}),
                                        i,
                                        stat.songs[0].songMetadata.metadata.album,
                                        stat.songs[0].songMetadata.metadata.albumArtist,
                                        `${lang("Listened for")} ${getDisplayedTime(stat.totalMs)}`,
                                        true
                                    )}
                                </button>
                            {/if}
                        {/each}
                        {#if expandArtistView[1].sortedAlbums.length > 5 && !areTopAlbumsOfArtistExpanded}
                            <button style="height: auto;" class="emptyButton maxWidth" onclick={() => (areTopAlbumsOfArtistExpanded = true)}>
                                <u>{lang("Load all")}</u><br>
                            </button>
                        {/if}
                    </div><br>
                    <i>{lang("Click on the album name above to see all the stats of the songs in that album")}.</i><br><br>
                    <Card secondCard={true}>
                        <h4 class="flex hcenter gap">
                        {lang("Plays divided by album and organized")}
                            <select style="width: fit-content;" bind:value={artistAlbumPlayed}>
                                {#if expandArtistView[1].chart?.perAlbum}
                                    <option value="selectedTimeInterval">{lang("in the selected time interval")}</option>
                                {/if}
                                {#if expandArtistView[1].chart?.albumsPlayedPerHour}
                                    <option value="hour">{lang("by hour")}</option>
                                {/if}
                                {#if expandArtistView[1].chart?.albumsPerMonth}
                                    <option value="month">{lang("by month")}</option>
                                {/if}
                                {#if expandArtistView[1].chart?.albumsPlayedPerYear}
                                    <option value="year">{lang("by year")}</option>
                                {/if}
                            </select><br><br>
                        </h4>
                        <ChartViewer exportInfo={{
                            title: `${lang("Top albums of")} ${expandArtistView[0]}${artistAlbumPlayed === "selectedTimeInterval" ? "" : `, ${lang("divided by")} ${lang(artistAlbumPlayed)}`}`,
                            dateInterval
                        }} chartObject={artistAlbumPlayed === "selectedTimeInterval" ? expandArtistView[1].chart?.perAlbum as ChartConfiguration : artistAlbumPlayed === "month" ? expandArtistView[1].chart?.albumsPerMonth as ChartConfiguration : artistAlbumPlayed === "hour" ? expandArtistView[1].chart?.albumsPlayedPerHour as ChartConfiguration : expandArtistView[1].chart?.albumsPlayedPerYear as ChartConfiguration}></ChartViewer>
                    </Card>
                </Card><br>
                <Card>
                    <h4>Most listened tracks:</h4>
                    {#if expandArtistView[1].songs.length > 2}
                        <Card secondCard={true}>
                            {@render PodiumWrapper([...expandArtistView[1].songs].sort((a, b) => b.playedMs - a.playedMs), `${lang("My top songs of")} ${expandArtistView[0]}`, "fetchalbum")}
                        </Card>
                    {/if}<br>
                    <div class="flex gap wrap wcenter statWrap" style="align-items: stretch">
                        {#each [...expandArtistView[1].songs].sort((a, b) => b.playedMs - a.playedMs) as song, i (song.songMetadata.trackId)}
                            {#if i < 5 || areTopTracksOfArtistExpanded}
                                <button class="emptyButton">
                                    {@render StatCard(
                                        GetAlbumArt({db: databases.albumArtDb, id: GetAlbumArtId({albumAuthor: song.songMetadata.metadata.albumArtist, year: song.songMetadata.metadata.year, albumName: song.songMetadata.metadata.album})}),
                                        i,
                                        song.songMetadata.metadata.title,
                                        `${song.songMetadata.metadata.album} – ${song.songMetadata.metadata.artist}`,
                                        `${lang("Listened for")} ${getDisplayedTime(song.playedMs)}`,
                                        true
                                    )}
                                </button>
                            {/if}
                        {/each}
                        {#if expandArtistView[1].sortedAlbums.length > 5 && !areTopTracksOfArtistExpanded}
                            <button style="height: auto;" class="emptyButton maxWidth" onclick={() => (areTopTracksOfArtistExpanded = true)}>
                                <u>{lang("Load all")}</u><br>
                            </button>
                        {/if}
                    </div><br>
                    <Card secondCard={true}>
                        <h4 class="flex hcenter gap">
                        {lang("Plays divided by album and organized")}
                            <select style="width: fit-content;" bind:value={artistSongPlayed}>
                                {#if expandArtistView[1].chart?.perSong}
                                    <option value="selectedTimeInterval">{lang("in the selected time interval")}</option>
                                {/if}
                                {#if expandArtistView[1].chart?.songsPlayedPerHour}
                                    <option value="hour">{lang("by hour")}</option>
                                {/if}
                                {#if expandArtistView[1].chart?.perSongDayOfWeek}
                                    <option value="day of week">{lang("by day of week")}</option>
                                {/if}
                                {#if expandArtistView[1].chart?.songsPerMonth}
                                    <option value="month">{lang("by month")}</option>
                                {/if}
                                {#if expandArtistView[1].chart?.songsPlayedPerYear}
                                    <option value="year">{lang("by year")}</option>
                                {/if}
                            </select><br><br>
                        </h4>
                        <ChartViewer exportInfo={{
                            title: `${lang("Top tracks of")} ${expandArtistView[0]}${artistSongPlayed === "selectedTimeInterval" ? "" : `, ${lang("divided by F")} ${lang(artistSongPlayed)}`}`,
                            dateInterval
                        }} chartObject={artistSongPlayed === "selectedTimeInterval" ? expandArtistView[1].chart?.perSong as ChartConfiguration : artistSongPlayed === "day of week" ? expandArtistView[1].chart?.perSongDayOfWeek as ChartConfiguration :  artistSongPlayed === "month" ? expandArtistView[1].chart?.songsPerMonth as ChartConfiguration : artistSongPlayed === "hour" ? expandArtistView[1].chart?.songsPlayedPerHour as ChartConfiguration : expandArtistView[1].chart?.songsPlayedPerYear as ChartConfiguration}></ChartViewer>
                    </Card>
                </Card><br>
                <Card>
                    <h4 class="flex hcenter gap">{lang("Plays per")} <select style="width: fit-content; background-color: var(--secondcard)" bind:value={artistMsPlays}>
                        <option value="hour">{lang("hour of day")}</option>
                        <option value="week">{lang("day of week")}</option>
                        {#if expandArtistView[1].chart?.perMonth}
                            <option value="month">{lang("month")}</option>
                            {#if expandArtistView[1].chart?.perYear}
                                <option value="year">{lang("year")}</option>
                            {/if}
                        {/if}
                    </select>:</h4>
                    <Card secondCard={true}>
                        <ChartViewer exportInfo={{
                            title: `${lang("Plays of")} ${expandArtistView[0]}, ${lang("divided by")} ${artistMsPlays === "week" ? lang("days of week") : lang(artistMsPlays)}`,
                            dateInterval
                        }} chartObject={artistMsPlays === "week" ? expandArtistView[1].chart?.perDayOfWeek as ChartConfiguration : artistMsPlays === "hour" ? expandArtistView[1].chart?.perHour as ChartConfiguration : artistMsPlays === "month" ? expandArtistView[1].chart?.perMonth as ChartConfiguration : expandArtistView[1].chart?.perYear as ChartConfiguration}></ChartViewer>
                    </Card>
                </Card>
            </Card>
        </div>
        {/if}
        {#if expandAlbumView}
        <div use:scrollToItem={"album"}>
            <Card secondCard={true}>
                <h3>{lang("Stats about")} {expandAlbumView[0].songs[0].songMetadata.metadata.album}{expandAlbumView[1] && expandArtistView ? ` (${lang("only tracks with")} ${expandArtistView[0]})` : ""}:</h3>
                {#if expandAlbumView[0].songs.length > 2}
                    <Card>
                        {@render PodiumWrapper(expandAlbumView[0].songs, `${lang("My top tracks of")} ${expandAlbumView[0].songs[0].songMetadata.metadata.album}${expandAlbumView[1] && expandArtistView ? ` (${lang("with")} ${expandArtistView[0]})` : ""}`, "no", true)}
                    </Card><br>
                {/if}
                <Card>
                    <h4>{lang("Most played songs")}:</h4>
                    <div class="flex gap wrap wcenter statWrap" style="align-items: stretch">
                        {#each expandAlbumView[0].songs as song, i (song.songMetadata.trackId)}
                            {#if i < 5 || areTopTracksOfAlbumExpanded}
                                <button class="emptyButton" onclick={() => {
                                    singleTrackToShow = song;
                                }}>
                                    {@render StatCard(
                                        new Promise<Blob>((res, rej) => rej()),
                                        i,
                                        song.songMetadata.metadata.title,
                                        song.songMetadata.metadata.artist,
                                        `${lang("Listened for")} ${getDisplayedTime(song.playedMs)} ${getHowManyTimes(song.playedMs, song.songMetadata.metadata.duration)}`,
                                        true
                                    )}
                                </button>
                            {/if}
                        {/each}
                        {#if expandAlbumView[0].songs.length > 5 && !areTopTracksOfAlbumExpanded}
                            <button style="height: auto;" class="emptyButton maxWidth" onclick={() => (areTopTracksOfAlbumExpanded = true)}>
                                <u>{lang("Load all")}</u>
                            </button>
                        {/if}
                </div>

            </Card><br>
            <Card>
                <h4 class="flex hcenter gap">{lang("Plays divided by song and organized")} <select style="width: fit-content; background-color: var(--secondcard)" bind:value={albumSongPlays}>
                {#if expandAlbumView[0].chart?.perSong}
                    <option value="selectedTimeInterval">{lang("in the selected time interval")}</option>
                {/if}
                {#if expandAlbumView[0].chart?.songsPlayedPerHour}
                    <option value="hour">{lang("by hour")}</option>
                {/if}
                {#if expandAlbumView[0].chart?.songsPerMonth}
                    <option value="month">{lang("by month")}</option>
                {/if}
                {#if expandAlbumView[0].chart?.songsPlayedPerYear}
                    <option value="year">{lang("by year")}</option>
                {/if}
                </select></h4>
                <Card secondCard={true}>
                    <ChartViewer exportInfo={{
                        title: `${lang("Top tracks of")} ${expandAlbumView[0].songs[0].songMetadata.metadata.album}${expandAlbumView[1] && expandArtistView ? ` (${lang("only tracks with")} ${expandArtistView[0]})` : ""}${albumSongPlays === "selectedTimeInterval" ? "" : `, ${lang("divided by F")} ${lang(albumSongPlays)}`}`,
                        dateInterval
                    }} chartObject={(albumSongPlays === "hour" ? expandAlbumView[0].chart?.songsPlayedPerHour : albumSongPlays === "month" ? expandAlbumView[0].chart?.songsPerMonth : albumSongPlays === "year" ? expandAlbumView[0].chart?.songsPlayedPerYear : expandAlbumView[0].chart?.perSong) as ChartConfiguration}></ChartViewer>
                </Card>
            </Card><br>
            <Card>
                <h4 class="flex hcenter gap">{lang("Plays per")} <select style="width: fit-content; background-color: var(--secondcard)" bind:value={albumMsPlays}>
                {#if expandAlbumView[0].chart?.perHour}
                    <option value="hour">{lang("hour")}</option>
                {/if}
                {#if expandAlbumView[0].chart?.perDayOfWeek}
                    <option value="week">{lang("week")}</option>
                {/if}
                {#if expandAlbumView[0].chart?.perMonth}
                    <option value="month">{lang("days of the month")}</option>
                {/if}
                {#if expandAlbumView[0].chart?.songsPerMonth}
                    <option value="monthyear">{lang("months of the year")}</option>
                {/if}
                {#if expandAlbumView[0].chart?.perYear}
                    <option value="year">{lang("year")}</option>
                {/if}
                </select>:</h4>
                    <Card secondCard={true}>
                        <ChartViewer exportInfo={{
                        title: `${lang("Plays of")} ${expandAlbumView[0].songs[0].songMetadata.metadata.album}${expandAlbumView[1] && expandArtistView ? ` (${lang("only tracks with")} ${expandArtistView[0]})` : ""}, ${lang("divided by")} ${albumMsPlays === "week" ? lang(`day of week`) : albumMsPlays === "monthyear" ? lang("month") : lang(albumMsPlays)} `,
                        dateInterval
                    }} chartObject={(albumMsPlays === "week" ? expandAlbumView[0].chart?.perDayOfWeek : albumMsPlays === "hour" ? expandAlbumView[0].chart?.perHour : albumMsPlays === "month" ? expandAlbumView[0].chart?.perMonth : albumMsPlays === "monthyear" ? expandAlbumView[0].chart?.songsPerMonth : expandAlbumView[0].chart?.perYear) as ChartConfiguration}></ChartViewer>
                    </Card>
                </Card>
            </Card>
        </div>
        {/if}
    </div>

{/if}

{#if singleTrackToShow}
<SongStats timeRange={startTime} songMetadata={singleTrackToShow.songMetadata} songStats={singleTrackToShow.source} closeCallback={() => (singleTrackToShow = undefined)}></SongStats>
{/if}


<style>
    .podiumPosition {
        max-width: 22%;
        width: 22%;
        border-radius: 12px;
    }
    .podiumPosition img {
        max-height: 100%;
        height: 100%;
        width: 100%;
        max-width: 100%;
        border-radius: 12px;
    }
    img {
        object-fit: cover;
    }
    .podium {
        border-top-left-radius: 12px;
        border-top-right-radius: 12px;
    }
    h2 > * {
        margin: 0px 5px;
    }
</style>