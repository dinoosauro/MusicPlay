import { mount, unmount } from "svelte";
import Alert from "../../lib/Dialogs/Alert.svelte";

/**
 * Show an alert on the top of the webpage.
 * @param str the string that should be shown in the dialog
 * @param appendSource where the dialog should be appended. If not passed, it'll be appended in the document body
 * @returns a Promise, resolved when the alert is closed.
 */
export default function ShowAlert(str: string, appendSource?: HTMLElement) {
    return new Promise<void>((res) => {
      const div = document.createElement("div");
      (appendSource ?? document.body).append(div);
      let mounted = mount(Alert, {
        target: div,
        props: {
          title: str,
          closeCallback: () => {
            unmount(mounted);
            div.remove();
            // @ts-ignore
            mounted = undefined;
            res();
          }
        }
      });
    })
}