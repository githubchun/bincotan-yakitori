#!/bin/sh
# Pricing + validation, then the booking lifecycle.
set -e
run() {
  node -e "
    const fs=require('fs'),vm=require('vm'),mem={};
    const ctx={ console,
      localStorage:{ getItem:k=>k in mem?mem[k]:null, setItem:(k,v)=>{mem[k]=String(v)}, removeItem:k=>{delete mem[k]} },
      location:{ origin:'https://example.test', pathname:'/', hash:'#/' },
      __exists:p=>fs.existsSync(p), __done:f=>process.exit(f?1:0) };
    vm.createContext(ctx);
    vm.runInContext(process.argv.slice(1).map(f=>fs.readFileSync(f,'utf8')).join('\n;\n'), ctx);
  " "$@"
}
echo "── pricing + validation ──"
run assets/js/menu-data.js assets/js/pricing.js test.js
echo
echo "── transaction record ──"
run assets/js/menu-data.js assets/js/pricing.js assets/js/ledger.js test-ledger.js
echo
echo "── booking lifecycle ──"
run assets/js/menu-data.js assets/js/pricing.js assets/js/ledger.js assets/js/store.js test-flow.js
