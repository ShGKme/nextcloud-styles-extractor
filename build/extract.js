/*
 * @copyright Copyright (c) 2024 Grigorii Shartsev <me@shgk.me>
 *
 * @author Grigorii Shartsev <me@shgk.me>
 *
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import { join } from 'node:path'
import { writeFile, rm, mkdir, readFile, cp } from 'node:fs/promises'
import 'zx/globals'
import { createReuseToml, filterReuseAnnotationsFiles, parseDep5 } from './utils/reuse.utils.js'

const VERSION = argv._[0] ?? ''
const CONTAINER_NAME = `nextcloud-server-styles-${VERSION.replaceAll('.', '_')}`
const PORT = 6123
const OUTPUT = `./styles/${VERSION}`

// Use bash with WSL even on Windows to simplify docker cp usage
useBash()
$.verbose = true
$.quiet = false

// Disable SSL verification to access Nextcloud server in nextcloud-easy-test container
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

if (!VERSION) {
	await echo('You must provide a version/branch as an argument.')
	process.exit(1)
}

const isNotCreatedContainer = async () => !(await $`docker inspect -f "{{.State.Status}}" ${CONTAINER_NAME}`.nothrow().quiet()).stdout.trim()
const isNotRunningContainer = async () => (await $`docker inspect -f "{{.State.Running}}" ${CONTAINER_NAME}`.nothrow().quiet()).stdout.trim() !== 'true'

const isContainerReady = async () => {
	try {
		return (await fetch(`https://localhost:${PORT}/status.php`)).ok
	} catch (e) {
		return false
	}
}

const isNotContainerReady = async () => !(await isContainerReady())

const cleanUpDir = async () => {
	await rm(OUTPUT, {recursive: true, force: true})
}

await spinner('[1/3] Preparing container. It might take a while...', async () => {
	// await $`docker rm --force ${CONTAINER_NAME}`
	if (await isNotCreatedContainer()) {
		// Create and start the container if not created
		await $`docker run -d -e SERVER_BRANCH=${VERSION} --name ${CONTAINER_NAME} -p ${PORT}:443 ghcr.io/szaimen/nextcloud-easy-test:latest`.run()
	} else {
		// Start an already existing container if not running
		if (await isNotRunningContainer()) {
			await $`docker start ${CONTAINER_NAME}`.run()
		}
	}

	while (await isNotRunningContainer()) {
		await sleep(1000)
	}

	while (await isNotContainerReady()) {
		await sleep(1000)
	}
})

await spinner('[2/3] Copying styles...', async () => {
	let hasDep5 = true
	// Prepare the output directory
	await cleanUpDir()
	await mkdir(OUTPUT)
	await mkdir(`${OUTPUT}/core`)
	await mkdir(`${OUTPUT}/core/img`)
	await mkdir(`${OUTPUT}/core/css`)
	await mkdir(`${OUTPUT}/dist`)
	await mkdir(`${OUTPUT}/apps/theming/`, {recursive: true})
	await mkdir(`${OUTPUT}/apps/theming/css`)
	await mkdir(`${OUTPUT}/apps/theming/theme`)
	await mkdir(`${OUTPUT}/apps/theming/img`)
	await mkdir(`${OUTPUT}/.reuse`)
	await cp('./build/template/index.js', OUTPUT + '/index.js')
	await cp('./build/template/theme.css', OUTPUT + '/theme.css')

	try {
		await $`docker cp ${CONTAINER_NAME}:/var/www/nextcloud/core/img/ ${OUTPUT}/core/`
		await $`docker cp ${CONTAINER_NAME}:/var/www/nextcloud/core/css/server.css ${OUTPUT}/core/css/`
		await $`docker cp ${CONTAINER_NAME}:/var/www/nextcloud/core/css/apps.css ${OUTPUT}/core/css/`
		await $`docker cp ${CONTAINER_NAME}:/var/www/nextcloud/dist/icons.css ${OUTPUT}/dist/`
		await $`docker cp ${CONTAINER_NAME}:/var/www/nextcloud/apps/theming/img/ ${OUTPUT}/apps/theming/`
		try {
			await $`docker cp ${CONTAINER_NAME}:/var/www/nextcloud/.reuse/dep5 ${OUTPUT}/.reuse/dep5`
		} catch {
			hasDep5 = false
		}

		const fixThemePaths = (css) => css.replaceAll('/apps/theming/', '../')
		const fetchCssToFile = (url, output) => fetch(url)
			.then((response) => response.text())
			.then((css) => writeFile(output, fixThemePaths(css)))

		await fetchCssToFile(`https://localhost:${PORT}/apps/theming/css/default.css`, join(OUTPUT, '/apps/theming/css/default.css'))
		await fetchCssToFile(`https://localhost:${PORT}/index.php/apps/theming/theme/light.css?plain=0&v=1`, join(OUTPUT, '/apps/theming/theme/light.css'))
		await fetchCssToFile(`https://localhost:${PORT}/index.php/apps/theming/theme/light.css?plain=1&v=2`, join(OUTPUT, '/apps/theming/theme/light.plain.css'))
		await fetchCssToFile(`https://localhost:${PORT}/index.php/apps/theming/theme/dark.css?plain=0&v=1`, join(OUTPUT, '/apps/theming/theme/dark.css'))
		await fetchCssToFile(`https://localhost:${PORT}/index.php/apps/theming/theme/dark.css?plain=1&v=2`, join(OUTPUT, '/apps/theming/theme/dark.plain.css'))

		if (!hasDep5) {
			return
		}
		const dep5 = await readFile(join(OUTPUT, '/.reuse/dep5'), 'utf-8')
		const reuse = parseDep5(dep5)
		reuse.annotations = filterReuseAnnotationsFiles(reuse.annotations, file =>
			file.startsWith('core/img')
			|| ['core/css/server.css', 'dist/icons.css', 'core/css/apps.css'].includes(file)
			|| file.startsWith('apps/theming/img/')
		)
		// Generated by a server file. Let's set the same license as default.css
		reuse.annotations.push({
			files: ['apps/theming/theme/light.css', 'apps/theming/theme/dark.css', 'apps/theming/theme/light.plain.css', 'apps/theming/theme/dark.plain.css'],
			copyright: '2022 Nextcloud GmbH and Nextcloud contributors',
			license: 'AGPL-3.0-or-later',
		})
		await writeFile(join(OUTPUT, 'REUSE.toml'), createReuseToml(reuse), 'utf-8')
		await rm(join(OUTPUT, '/.reuse'), {recursive: true})
	} catch (e) {
		await echo('Something went wrong:', e.stderr ?? e)
		await cleanUpDir()
	}
})

await spinner('[3/3] Removing container...', async () => {
	await $`docker rm --force ${CONTAINER_NAME}`
})
