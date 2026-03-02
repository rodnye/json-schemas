import { promises as fs } from 'fs';
import { join } from 'path';

const START_MARKER = '<!-- SCHEMAS -->';
const END_MARKER = '<!-- /SCHEMAS -->';
const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER;
const REPO_NAME = process.env.GITHUB_REPOSITORY.split('/')[1];

async function main() {
  const readmePath = join(process.cwd(), 'README.md');
  const readmeContent = await fs.readFile(readmePath, 'utf8');

  const startIndex = readmeContent.indexOf(START_MARKER);
  const endIndex = readmeContent.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1) {
    console.error('FATAL!!! Markers not found in README.md');
    process.exit(1);
  }

  const schemasDir = join(process.cwd(), 'schemas');
  let schemaFiles = await fs.readdir(schemasDir);
  schemaFiles = schemaFiles.filter((file) => file.endsWith('.json'));

  const baseUrl = `https://${REPO_OWNER}.github.io/${REPO_NAME}/schemas/`;
  const schemaUrls = schemaFiles
    .map((file) => `- ${baseUrl}${file}`)
    .join('\n');

  const newSection = `${START_MARKER}\n${schemaUrls}\n${END_MARKER}`;
  const before = readmeContent.substring(0, startIndex);
  const after = readmeContent.substring(endIndex + END_MARKER.length);
  const newReadme = before + newSection + after;

  if (newReadme !== readmeContent) {
    await fs.writeFile(readmePath, newReadme, 'utf8');
    console.log('README.md updated');
  } else {
    console.log('No changes needed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
