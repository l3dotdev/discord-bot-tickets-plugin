import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import ts from "typescript-eslint";
import importX from "eslint-plugin-import-x";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
	globalIgnores(["eslint.config.js", "vite.config.ts", "**/build/", "**/dist/"]),
	js.configs.recommended,
	ts.configs.recommended,
	importX.flatConfigs.recommended,
	importX.flatConfigs.typescript,
	prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		settings: {
			"import/parsers": {
				"@typescript-eslint/parser": [".ts"]
			},
			"import-x/resolver-next": [
				createTypeScriptImportResolver({
					project: "tsconfig.json"
				})
			]
		},
		rules: {
			"import-x/no-duplicates": "off",
			"import-x/order": [
				"warn",
				{
					groups: ["builtin", "external", "internal", ["sibling", "parent"], "index"],
					alphabetize: {
						order: "asc",
						caseInsensitive: true
					},
					"newlines-between": "always"
				}
			],
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_"
				}
			]
		}
	}
);
