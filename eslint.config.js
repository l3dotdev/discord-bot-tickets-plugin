import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import tseslint from "typescript-eslint";
import "eslint-import-resolver-typescript";

export default tseslint.config(
	{
		ignores: ["eslint.config.js", "vite.config.ts", "**/build/", "**/dist/"]
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	prettier,
	importPlugin.flatConfigs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				App: "readonly"
			}
		}
	},
	{
		settings: {
			"import/parsers": {
				"@typescript-eslint/parser": [".ts"]
			},
			"import/resolver": {
				typescript: {
					project: import.meta.dirname + "/*/tsconfig.json"
				},
				node: {
					extensions: [".js", ".jsx", ".ts", ".tsx"]
				}
			}
		}
	},
	{
		rules: {
			"import/no-unresolved": [
				"error",
				{
					ignore: ["^\\$app/.+", "^\\$env/.+"]
				}
			],
			"import/no-duplicates": "off",
			"import/order": [
				"warn",
				{
					groups: ["builtin", "external", "internal", ["sibling", "parent"], "index"],
					alphabetize: {
						order: "asc",
						caseInsensitive: true
					},
					"newlines-between": "always",
					pathGroups: [
						{
							pattern: "\$**",
							group: "internal"
						},
						{
							pattern: "$env/**",
							group: "internal"
						},
						{
							pattern: "$app/**",
							group: "internal"
						}
					]
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
	},
	{
		files: ["discord.js-helpers/**/*.ts", "result/**/*.ts", "api-result/**/*.ts"],
		rules: {
			"import/extensions": ["error", "always", { ts: "never" }]
		}
	}
);
