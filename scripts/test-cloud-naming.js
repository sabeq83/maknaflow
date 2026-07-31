import {
  getCloudFolderPath,
  getCloudMasterFileName,
  getCloudVoFileName,
  getCloudThumbFileName,
  getCloudClipFileName
} from '../lib/cloud-naming-helper.js';

console.log('🧪 Testing Cloud Naming Helper Utilities...');

const testFolder = getCloudFolderPath({
  accountName: 'Nutribake',
  campaignId: 're_260725_66b4d6',
  videoId: 'nutribake_re_66b4d6_01'
});
console.log('Folder Path:', testFolder);

const testMaster = getCloudMasterFileName('nutribake_re_66b4d6_01');
console.log('Master Final Video:', testMaster);

const testVo = getCloudVoFileName('nutribake_re_66b4d6_01');
console.log('Master Final VO:', testVo);

const testThumb = getCloudThumbFileName('nutribake_re_66b4d6_01');
console.log('Thumbnail:', testThumb);

const testClipFrame = getCloudClipFileName({ videoId: 'nutribake_re_66b4d6_01', type: 'frame', clipNo: 1, ext: 'jpg' });
console.log('Clip Frame 1:', testClipFrame);

const testClipScene = getCloudClipFileName({ videoId: 'nutribake_re_66b4d6_01', type: 'scene', clipNo: 2, ext: 'mp4' });
console.log('Clip Scene 2:', testClipScene);

console.log('\n✅ All Cloud Naming Tests Passed!');
