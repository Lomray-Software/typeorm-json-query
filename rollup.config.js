import typescript from 'rollup-plugin-ts';
import ttypescript from 'ttypescript';

export default {
  input: 'src/index.ts',
  output: {
    file: 'lib/index.js',
    format: 'cjs'
  },
  plugins: [
    typescript({
      typescript: ttypescript,
      tsconfig: resolvedConfig => ({
        ...resolvedConfig,
        declaration: true,
      }),
    }),
  ],
  external: ['typeorm', '@lomray/microservices-types'],
};
