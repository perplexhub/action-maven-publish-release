const { execSync } = require("child_process");
const { unlinkSync, writeFileSync } = require("fs");
const path = require("path");

const gpgKeyPath = path.join(__dirname, "private-key.txt");
const mavenSettingsPath = path.join(__dirname, "settings.xml");

/**
 * Logs to the console
 * @param msg {string}: Text to log to the console
 */
function log(msg) {
	console.log(msg); // eslint-disable-line no-console
}

/**
 * Executes the provided shell command and redirects stdout/stderr to the console
 * @param cmd {string}: Shell command to execute
 * @param cwd {string | null}: Directory in which the command should be run
 * @returns {Buffer | string}: The stdout from the command
 */
function run(cmd, cwd = null) {
	return execSync(cmd, { encoding: "utf8", stdio: "inherit", cwd });
}

/**
 * Returns the value for an environment variable
 * @param name {string}: Name of the environment variable
 * @returns {string | undefined}: Value of the environment variable
 */
function getEnv(name) {
	return process.env[name];
}

/**
 * Returns the value for an input variable. If the variable is required and doesn't have a value,
 * abort the action
 * @param name {string}: Name of the input variable
 * @param required {boolean}: If set to true, the action will exit if the variable is not defined
 * @returns {string | null}: Value of the input variable
 */
function getInput(name, required = false) {
	const value = getEnv(`INPUT_${name.toUpperCase()}`);
	if (value == null) {
		// Value is either not set (`undefined`) or set to `null`
		if (required) {
			throw new Error(`"${name}" input variable is not defined`);
		}
		return null;
	}
	return value;
}

/**
 * Deploys the Maven project
 */
function runAction() {
	// Make sure the required input variables are provided
	getInput("nexus_username", true);
	getInput("nexus_password", true);

	const mavenArgs = getInput("maven_args", true);

	// Import GPG key into keychain
	const privateKey = getInput("gpg_private_key").trim();
	if (privateKey) {
		// Make sure passphrase is provided
		getInput("gpg_passphrase", true);

		// Import private key (write into temporary file and import that file)
		log("Importing GPG key…");
		writeFileSync(gpgKeyPath, privateKey);
		run(`gpg --import --batch ${gpgKeyPath}`);
		unlinkSync(gpgKeyPath);
	}

	const activateProfiles = getInput("activate_profiles", true).trim();
	// Deploy to Nexus
	// The "deploy" profile is used in case the user wants to perform certain steps only during
	// deployment and not in the install phase
	const gitUsername = getInput("git_username", true);
	const gitEmail = getInput("git_email", true);
	const gitOriginUrl = getInput("git_origin_url", true);
	log("Releasing the Maven project");
	run(
		`git config --global user.email "${gitEmail}";git config --global user.name "${gitUsername}";git remote set-url origin ${gitOriginUrl};mvn release:clean release:prepare --batch-mode --activate-profiles ${activateProfiles} --settings ${mavenSettingsPath} ${mavenArgs}`,
		getInput("directory") || null,
	);
	run(
		`git config --global user.email "${gitEmail}";git config --global user.name "${gitUsername}";git remote set-url origin ${gitOriginUrl};mvn release:perform --batch-mode --activate-profiles ${activateProfiles} --settings ${mavenSettingsPath} ${mavenArgs}`,
		getInput("directory") || null,
	);
}

runAction();
