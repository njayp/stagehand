const { Stagehand } = require('@browserbasehq/stagehand');

async function main() {
  const sh = new Stagehand({ env: 'LOCAL' });
  await sh.init();
  console.log('Keys of sh:', Object.keys(sh));
  console.log('Is page present?', !!sh.page);
  console.log('Is context present?', !!sh.context);
  if (sh.page) {
    console.log('Keys of page:', Object.keys(sh.page));
  }
  if (sh.context) {
    console.log('Keys of context:', Object.keys(sh.context));
    if (Object.getPrototypeOf(sh.context)) {
      console.log('Methods of context:', Object.getOwnPropertyNames(Object.getPrototypeOf(sh.context)));
    }
  }
  await sh.close();
}

main().catch(console.error);
