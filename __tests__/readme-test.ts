import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { describe, it } from 'mocha';

// npm test runs from the repository root in both CommonJS and native ESM.
const root = process.cwd();
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  name: string;
  version: string;
  peerDependencies: Record<string, string>;
};

/**
 * Keep documented versions, links and the example in step with the package
 */
describe('readme', () => {
  it('should document the package version and its typeorm peer version', () => {
    expect(readme).to.include(`${manifest.name}@2.7.0`);
    expect(readme).to.include(
      `Release \`2.7.0\` requires **TypeORM ${manifest.peerDependencies.typeorm}**`,
    );
    expect(readme).to.include(`typeorm@${manifest.peerDependencies.typeorm}`);
  });

  it('should only link to existing repository files', () => {
    const links = [...readme.matchAll(/]\(([^)]+)\)/g)]
      .map(([, link]) => link.split('#')[0])
      .filter((link) => link && !/^(https?:|mailto:)/.test(link));

    expect(links).to.not.be.empty;
    links.forEach((link) => expect(fs.existsSync(path.join(root, link)), link).to.be.true);
  });

  it('should keep the documented example aligned with the public api', () => {
    const [example] = [...readme.matchAll(/```javascript\n([\s\S]*?)```/g)].map(([, code]) => code);

    expect(example, 'javascript example').to.be.a('string');
    expect(example).to.include(`require('${manifest.name}')`);
    expect(example).to.include('TypeormJsonQuery.init(');
    expect(example).to.include('.toQuery()');
    expect(example).to.include('isLateralJoins: false');
    expect(example).to.include("distinctType: 'all'");
  });
});
