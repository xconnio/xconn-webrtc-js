import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";

export default [
    {
        input: "lib/index.ts",
        output: [
            {
                file: "dist/index.js",
                format: "esm",
                sourcemap: true
            },
            {
                file: "dist/index.cjs",
                format: "cjs",
                sourcemap: true
            }
        ],
        external: [
            "xconn",
            "uuid"
        ],
        plugins: [
            resolve({
                browser: true,
                preferBuiltins: false
            }),
            commonjs(),
            typescript({ tsconfig: "./tsconfig.json" })
        ]
    },

    {
        input: "dist/index.d.ts",
        output: [{ file: "dist/index.d.ts", format: "esm" }],
        plugins: [dts()]
    }
];
