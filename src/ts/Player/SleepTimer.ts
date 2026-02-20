import AudioManager from "../Player/AudioManager";

const obj = {
    /**
     * Information about the currently-running sleep timer
     */
    timerArguments: {
        remainingHours: 0,
        remainingMinutes: 15,
        remainingSeconds: 0,
        isRunning: false,
        /**
         * If true, the timer won't be stopped when it reaches `0`, but instead after the track playback ends.
         */
        stopAtNextTrack: false
    },
    /**
     * The ID of the interval that is running every second to reduce the number of seconds/minutes/hours missing from the end of the sleep timer
     */
    currentSleepTimer: undefined as number | undefined,
    /**
     * Start a new sleep timer. To set its length, change the `remaining[...]` properties in the `timerArguments` object.
     */
    startSleepTimer: () => {
        obj.clearSleepTimer();
        obj.timerArguments.isRunning = true;
            obj.currentSleepTimer = setInterval(() => {
                obj.timerArguments.remainingSeconds--;
                if (obj.timerArguments.remainingSeconds === -1) {
                    obj.timerArguments.remainingSeconds = 59;
                    obj.timerArguments.remainingMinutes--;
                    if (obj.timerArguments.remainingMinutes === -1) {
                        obj.timerArguments.remainingMinutes = 59;
                        obj.timerArguments.remainingHours--;
                        if (obj.timerArguments.remainingHours === -1) {
                            obj.timerArguments.remainingHours = 0;
                            obj.timerArguments.remainingMinutes = 0;
                            obj.timerArguments.remainingSeconds = 0;
                            if (!obj.timerArguments.stopAtNextTrack) {
                                AudioManager.audio?.pause();
                                obj.timerArguments.isRunning = false;
                            }
                            clearInterval(obj.currentSleepTimer);
                        }
                    }
                }
            }, 1000);
    },
    /**
     * Remove the currently-running sleep timer
     */
    clearSleepTimer: () => {
        clearInterval(obj.currentSleepTimer);
        obj.timerArguments.isRunning = false;
    }
}
export default obj;