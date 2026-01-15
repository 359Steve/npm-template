#!/usr/bin/env node
import fsExtra from "fs-extra";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import ora from "ora";
import chalk from "chalk";
import enquirerPkg from "enquirer";
import gradient from "gradient-string";

const { prompt } = enquirerPkg
const { copy, readJSON, writeJSON, remove } = fsExtra;

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// 打印欢迎信息
function printWelcome() {
	console.log();
	console.log(gradient.morning("✨ 欢迎使用 XXX 脚手架 ✨"));
	console.log();
}

// 验证项目名称
function isValidPackageName(projectName) {
	return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
		projectName
	);
}

// 格式化项目名称
function toValidPackageName(projectName) {
	return projectName
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/^[._]/, "")
		.replace(/[^a-z0-9-~]+/g, "-");
}

// 将包名转换为目录名
function packageNameToDirName(packageName) {
	if (packageName.includes("/")) {
		return packageName.split("/")[1];
	}
	return packageName;
}

// 交互式提问
async function askForOptions(targetDir) {
	const options = await prompt([
		{
			type: "input",
			name: "packageName",
			message: "请输入项目名称",
			initial: toValidPackageName(targetDir),
			validate: (name) =>
				isValidPackageName(name) || "项目名称不符合 npm 包命名规则",
		},
		{
			type: "confirm",
			name: "installDeps",
			message: "是否立即安装依赖?",
			initial: true,
		},
	]);

	return options;
}

// 拷贝模板
async function copyTemplate(src, dest) {
	const spinner = ora(`正在创建项目...`).start();
	try {
		await copy(src, dest);
		spinner.succeed("项目创建成功");
	} catch (err) {
		spinner.fail("项目创建失败");
		throw err;
	}
}


// 更新 package.json
async function updatePackageJson(destDir, projectName) {
	const packageJsonPath = join(destDir, "package.json");
	const packageJson = await readJSON(packageJsonPath);
	packageJson.name = projectName;
	await writeJSON(packageJsonPath, packageJson, { spaces: 2 });
}

// 安装依赖
async function installDependencies(destDir) {
	const spinner = ora("正在安装依赖...").start();

	try {
		await new Promise((resolve, reject) => {
			const installer = spawn("npm", ["install"], {
				cwd: destDir,
				stdio: "ignore",
				shell: true,
			});

			installer.on("close", (code) => {
				if (code === 0) resolve();
				else reject(new Error(`npm install 失败，退出码 ${code}`));
			});
		});
		spinner.succeed("依赖安装完成");
	} catch (err) {
		spinner.fail(`依赖安装失败: ${err.message}`);
		throw err;
	}
}

// 打印完成信息
function printCompletion(targetDir, installDeps) {
	console.log();
	console.log(chalk.bold("🎉  项目创建完成!"));
	console.log();

	console.log(chalk.bold("接下来可以执行以下命令:"));
	console.log();
	console.log(chalk.dim(` # 进入项目目录`));
	console.log(` cd ${chalk.cyan(targetDir)}`);

	if (!installDeps) {
		console.log(chalk.dim(` # 安装依赖`));
		console.log(` npm install`);
	}

	console.log(chalk.dim(` # 启动开发服务器`));
	console.log(` npm run dev`);
	console.log();
	console.log(chalk.dim(` # 构建生产版本`));
	console.log(` npm run build`);
	console.log();
}

// 主函数
async function main() {
	printWelcome();

	// 获取初始目标目录
	const initialTargetDir = process.argv[2];

	if (!initialTargetDir) {
		console.error(
			chalk.red("❌ 必须指定项目名称，例如:") +
			chalk.cyan("npx XXX my-project")
		);
		process.exit(1);
	}

	let destDir = null;
	let finalDirName = null;

	try {
		// 先获取用户选项
		const options = await askForOptions(initialTargetDir);

		// 基于用户输入的项目名称确定最终目录名
		finalDirName = packageNameToDirName(options.packageName);
		destDir = resolve(process.cwd(), finalDirName);

		// 检查目录是否已存在
		if (fsExtra.existsSync(destDir)) {
			console.error(chalk.red(`❌ 目录 "${finalDirName}" 已存在!`));
			process.exit(1);
		}

		// 拷贝模板
		await copyTemplate(join(__dirname, "template"), destDir);

		// 更新 package.json
		await updatePackageJson(destDir, options.packageName);

		// 安装依赖
		if (options.installDeps) {
			await installDependencies(destDir);
		}

		// 打印完成信息
		printCompletion(finalDirName, options.installDeps);
	} catch (err) {
		console.error(chalk.red("❌ 创建项目失败:"), err.message);

		// 清理已创建的文件
		if (destDir && fsExtra.existsSync(destDir)) {
			const spinner = ora("清理已创建的文件...").start();
			await remove(destDir);
			spinner.succeed("清理完成");
		}

		process.exit(1);
	}
}

main().catch((err) => {
	console.error(chalk.red("❌ 发生未预期的错误:"), err);
	process.exit(1);
});