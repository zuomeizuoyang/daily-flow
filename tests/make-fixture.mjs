import {writeFileSync} from 'node:fs';
import {baseStore,newTask} from '../src/model.ts';
const store=baseStore();store.tasks=[{...newTask('导入验收：备份恢复','2026-09-16','learn'),notes:'由回归测试生成，无真实个人信息',time:840}];writeFileSync(new URL('./import-fixture.json',import.meta.url),JSON.stringify(store,null,2));
