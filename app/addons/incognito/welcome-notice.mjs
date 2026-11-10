// DSH shows its internal-testing notice until the profile records the notice version the user
// acknowledged. Private chats run on an in-memory profile that starts fresh on every unlock and
// after a chat is deleted, so the acknowledgement is read from the normal DSH profile, and one
// made in private mode is saved back there. Only the notice version is recorded.
export const WELCOME_NS = "ui-settings-general";
export const WELCOME_FIELD = "welcomeNoticeVersion";

export const isWelcomeVersion = (value) =>
  typeof value === "string" && /^[0-9A-Za-z][0-9A-Za-z.-]{0,63}$/.test(value);

const acknowledged = (describe) => describe.find((row) => row.ns === WELCOME_NS)?.value?.[WELCOME_FIELD];

// Settings seed for the private runtime, from the normal profile's settings forms.
export function welcomeSeed(describe) {
  const version = acknowledged(describe);
  return isWelcomeVersion(version) ? { [WELCOME_NS]: { [WELCOME_FIELD]: version } } : {};
}

// Save an acknowledgement made in private mode to the normal profile.
export async function rememberWelcome(settings, version) {
  if (!isWelcomeVersion(version)) throw Error("Invalid notice version");
  if (acknowledged(settings.describe()) === version) return false;
  await settings.update(WELCOME_NS, { [WELCOME_FIELD]: version });
  return true;
}
