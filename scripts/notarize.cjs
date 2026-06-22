/**
 * electron-builder afterSign hook — notarize Clarifi with Apple notarytool.
 * Requires: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
 * Optional: APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER (instead of password)
 */
const { notarize } = require('@electron/notarize')
const path = require('path')

exports.default = async function notarizeApp(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)

  const appleId = process.env.APPLE_ID
  const appleIdPassword =
    process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_ID_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID
  const appleApiKey = process.env.APPLE_API_KEY
  const appleApiKeyId = process.env.APPLE_API_KEY_ID
  const appleApiIssuer = process.env.APPLE_API_ISSUER

  const hasPasswordCreds = appleId && appleIdPassword && teamId
  const hasApiKeyCreds = appleApiKey && appleApiKeyId && appleApiIssuer

  if (process.env.SKIP_NOTARIZE === '1') {
    console.log('Skipping notarization (SKIP_NOTARIZE=1).')
    return
  }

  if (!hasPasswordCreds && !hasApiKeyCreds) {
    console.warn('Skipping notarization — no Apple credentials in environment.')
    return
  }

  console.log(`Notarizing ${appPath}...`)

  const options = {
    tool: 'notarytool',
    appPath,
    appBundleId: 'com.clarifi.desktop',
  }

  if (hasApiKeyCreds) {
    options.appleApiKey = appleApiKey
    options.appleApiKeyId = appleApiKeyId
    options.appleApiIssuer = appleApiIssuer
  } else {
    options.appleId = appleId
    options.appleIdPassword = appleIdPassword
    options.teamId = teamId
  }

  await notarize(options)
  console.log('Notarization complete.')
}
