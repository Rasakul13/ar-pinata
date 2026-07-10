# iPhone/iPad release without local Xcode

The native ARKit game can be built on GitHub's macOS runner and uploaded to TestFlight. You do not need to install Xcode locally. Apple still requires the app owner to enroll in the Apple Developer Program and create the signing credentials in their own Apple account.

## 1. Create the Apple app

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/enroll/).
2. In **Certificates, Identifiers & Profiles**, register an App ID. Use a unique bundle ID, for example `com.rasakul.ARPinataIOS`.
3. In [App Store Connect](https://appstoreconnect.apple.com/), create a new iOS app with exactly the same bundle ID.

The Xcode project defaults to `com.rasakul.ARPinataIOS`, but the release workflow overrides it with the GitHub variable `IOS_BUNDLE_ID`. This means you can choose another unique identifier without editing the project file.

## 2. Create the distribution certificate without Xcode

1. Open **Keychain Access** on the Mac.
2. Choose **Keychain Access > Certificate Assistant > Request a Certificate From a Certificate Authority** and save the certificate request to disk.
3. In the Apple Developer portal, create an **Apple Distribution** certificate using that request and download the `.cer` file.
4. Open the downloaded certificate so it is added to Keychain Access.
5. In **My Certificates**, export the certificate together with its private key as a password-protected `.p12` file.
6. Copy the Base64 representation to the clipboard:

   ```sh
   base64 -i ios_distribution.p12 | pbcopy
   ```

## 3. Create the provisioning profile

In the Apple Developer portal, create an **App Store Connect** distribution provisioning profile for the App ID and Apple Distribution certificate from the previous steps. Give it a clear name, for example:

```text
AR Pinata App Store
```

The workflow downloads this profile through Apple's API, so the profile file itself does not need to be stored in GitHub.

## 4. Create an App Store Connect API key

1. Open **App Store Connect > Users and Access > Integrations > App Store Connect API**.
2. Generate a **Team Key** with the **App Manager** role.
3. Download the `.p8` file immediately. Apple only allows it to be downloaded once.
4. Note the displayed **Key ID** and **Issuer ID**.

## 5. Configure the GitHub release environment

Open the GitHub repository and go to **Settings > Environments > New environment**. Create an environment named exactly:

```text
ios-release
```

Add these environment variables under **Variables**:

| Variable | Value |
| --- | --- |
| `APPLE_TEAM_ID` | The 10-character Apple Developer Team ID |
| `IOS_BUNDLE_ID` | The registered bundle ID, for example `com.rasakul.ARPinataIOS` |
| `IOS_PROVISIONING_PROFILE_NAME` | Exact name of the App Store provisioning profile |
| `APPSTORE_API_KEY_ID` | Key ID of the App Store Connect API key |
| `APPSTORE_ISSUER_ID` | Issuer ID of the App Store Connect API key |

Add these values under **Environment secrets**:

| Secret | Value |
| --- | --- |
| `APPSTORE_API_PRIVATE_KEY` | Complete contents of the downloaded `.p8` file, including the BEGIN/END lines |
| `APPSTORE_CERTIFICATES_FILE_BASE64` | Base64 text copied from the `.p12` file |
| `APPSTORE_CERTIFICATES_PASSWORD` | Password assigned while exporting the `.p12` file |

Never commit the `.p8`, `.p12`, passwords, or Base64 certificate to the repository.

## 6. Upload a build to TestFlight

1. Open the repository's **Actions** tab.
2. Select **Release native iOS app to TestFlight**.
3. Click **Run workflow**.

Each run builds the ARKit app on a GitHub-hosted Mac, assigns a unique build number, signs the archive, exports the IPA, and uploads it to TestFlight. The workflow fails with a clear message if a required variable or secret is missing.

## 7. Create the link for iPhone users

After Apple finishes processing the build:

1. Open the app's **TestFlight** tab in App Store Connect.
2. Create an internal testing group first, then an external testing group.
3. Add the build and submit the first external build for TestFlight Beta App Review.
4. After approval, select the external group and choose **Create Public Link**.
5. Copy the resulting URL, which looks like `https://testflight.apple.com/join/ABC12345`.
6. Put it in the repository `.env`:

   ```dotenv
   IOS_APP_URL=https://testflight.apple.com/join/ABC12345
   ```

7. Commit and push the `.env` change. The Pages workflow rebuilds the website automatically.

From then on, an iPhone or iPad visitor sees a TestFlight installation button. The public link lets the visitor join the beta and install the native AR app. TestFlight must be installed on the device. After installation, the game is launched as a normal iOS app and uses ARKit rather than browser camera emulation.

TestFlight builds are available for 90 days. For a permanent installation link, submit the tested build to the public App Store and later replace `IOS_APP_URL` with its App Store URL.

