//#region src/product-identity.ts
/** Stable and Beta identities used to locate each edition's private app data. */
const DESKTOP_RELEASE_IDENTITIES = Object.freeze({
	stable: Object.freeze({
		releaseChannel: "stable",
		packageName: "dsh-plugin-desktop",
		productName: "DSH Desktop",
		appId: "ai.deepseek.dsh.desktop",
		homeDirectoryName: ".dsh"
	}),
	beta: Object.freeze({
		releaseChannel: "beta",
		packageName: "dsh-plugin-desktop-beta",
		productName: "DSH Private",
		appId: "org.dshprivate.desktop",
		homeDirectoryName: ".dsh-private"
	})
});
/** Beta release-channel identities that must stay aligned with electron-builder. */
const DESKTOP_PRODUCT_IDENTITY = DESKTOP_RELEASE_IDENTITIES.beta;
const OTHER_DESKTOP_PRODUCT_IDENTITY = DESKTOP_RELEASE_IDENTITIES.stable;
const DESKTOP_PACKAGE_NAME = DESKTOP_PRODUCT_IDENTITY.packageName;
const STABLE_DESKTOP_PACKAGE_NAME = OTHER_DESKTOP_PRODUCT_IDENTITY.packageName;
const DESKTOP_PRODUCT_NAME = DESKTOP_PRODUCT_IDENTITY.productName;
const DESKTOP_APP_ID = DESKTOP_PRODUCT_IDENTITY.appId;
const DESKTOP_RELEASE_CHANNEL = DESKTOP_PRODUCT_IDENTITY.releaseChannel;
DESKTOP_PRODUCT_IDENTITY.homeDirectoryName;
/** Both Desktop package identities are launcher-owned, never Profile plugins. */
const DESKTOP_PACKAGE_NAMES = /* @__PURE__ */ new Set([STABLE_DESKTOP_PACKAGE_NAME, DESKTOP_PACKAGE_NAME]);
//#endregion
export { DESKTOP_PRODUCT_NAME as a, OTHER_DESKTOP_PRODUCT_IDENTITY as c, DESKTOP_PRODUCT_IDENTITY as i, DESKTOP_PACKAGE_NAME as n, DESKTOP_RELEASE_CHANNEL as o, DESKTOP_PACKAGE_NAMES as r, DESKTOP_RELEASE_IDENTITIES as s, DESKTOP_APP_ID as t };

//# sourceMappingURL=product-identity-DOSu4si7.js.map