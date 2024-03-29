export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function makeString(length: number): string {
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  let outString: string = ``;
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  const inOptions: string = `abcdefghijklmnopqrstuvwxyz0123456789`;

  for (let i = 0; i < length; i++) {
    outString += inOptions.charAt(Math.floor(Math.random() * inOptions.length));
  }

  return outString;
}

export function formatTime(ms: number): string {
  if (ms === undefined) return "";
  if (ms < 1000) return ms.toString() + " ms";
  if (ms < 60 * 1000)
    return parseInt((ms / 1000).toString()).toString() + " sec";
  if (ms < 60 * 60 * 1000) {
    const minutes = parseInt((ms / 1000 / 60).toString());
    const seconds = parseInt(((ms - minutes * 60 * 1000) / 1000).toString());
    return minutes.toString() + " min " + seconds.toString() + " sec";
  } else {
    const hours = parseInt((ms / 1000 / 60 / 60).toString());
    const minutes = parseInt(
      ((ms - hours * 60 * 60 * 1000) / 1000 / 60).toString()
    );
    return hours.toString() + " h " + minutes.toString() + " min";
  }
}
