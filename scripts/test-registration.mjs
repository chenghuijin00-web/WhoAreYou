import assert from 'node:assert/strict';
import { TestProtocol } from '../src/protocol/interface.ts';
import { naifrogTest } from '../src/instance/naifrogTest.ts';

const protocol = new TestProtocol();
for (let attempt = 0; attempt < 50; attempt++) protocol.registerTest(naifrogTest);
assert.equal(protocol.getRegisteredTests().length, 1, '重测不应重复注册同一个题库');
assert.equal(protocol.dimensions.length, naifrogTest.dimensions.length);
assert.equal(protocol.personalityTypes.length, 16);
protocol.startTest(naifrogTest.id);
naifrogTest.questions.forEach(question => protocol.submitAnswer(question.id, 'neutral'));
const original = protocol.getResult();
const updated = structuredClone(naifrogTest);
updated.version = 'registration-regression';
updated.questions[0].id = 'replacement-question';
protocol.registerTest(updated);
// 注册新版本不篡改正在作答的旧配置；下一次开始才使用新版本。
assert.deepEqual(protocol.getResult(), original);
protocol.startTest(updated.id);
assert.throws(() => protocol.submitAnswer(naifrogTest.questions[0].id, 'a'), /不存在/);
updated.questions.forEach(question => protocol.submitAnswer(question.id, 'neutral'));
assert.equal(protocol.getResult().questionnaire_version, updated.version);
assert.equal(protocol.getRegisteredTests().length, 1);
const different = { ...updated, id: 'another-theme' };
protocol.registerTest(different);
assert.equal(protocol.getRegisteredTests().length, 2);
console.log('PASS: 50次重复注册不增长、同ID新版本生效、当前作答不受更新影响、不同主题共存。');
