#!/bin/sh
# Pricing + validation, then the booking lifecycle.
set -e
run() {
  node -e "
    const fs=require('fs'),vm=require('vm'),mem={};
    const ctx={ console,
      localStorage:{ getItem:k=>k in mem?mem[k]:null, setItem:(k,v)=>{mem[k]=String(v)}, removeItem:k=>{delete mem[k]} },
      location:{ origin:'https://example.test', pathname:'/', hash:'#/' },
      __exists:p=>fs.existsSync(p),
      __imageCount:()=>fs.readdirSync('assets/img').filter(f=>f.endsWith('.webp')).length,
      __count:(f,re)=>(fs.readFileSync(f,'utf8').match(re)||[]).length,
      __docCount:()=>fs.readdirSync('docs').filter(f=>f.endsWith('.md')).length,
      __done:f=>process.exit(f?1:0) };
    vm.createContext(ctx);
    vm.runInContext(process.argv.slice(1).map(f=>fs.readFileSync(f,'utf8')).join('\n;\n'), ctx);
  " "$@"
}
TOTAL=0
tally(){ TOTAL=$((TOTAL + $1)); }

echo "── pricing + validation ──"
run assets/js/menu-data.js assets/js/pricing.js test.js | tee /tmp/_t1
echo
echo "── transaction record ──"
run assets/js/menu-data.js assets/js/pricing.js assets/js/ledger.js test-ledger.js | tee /tmp/_t2
echo
echo "── documentation claims ──"
run assets/js/menu-data.js assets/js/pricing.js assets/js/ledger.js assets/js/store.js test-docs.js | tee /tmp/_t3
echo
echo "── booking lifecycle ──"
run assets/js/menu-data.js assets/js/pricing.js assets/js/ledger.js assets/js/store.js test-flow.js | tee /tmp/_t4

echo
echo "════════════════════════════════════════"
awk '/passed,/ {p+=$1; f+=$3} END {printf "  %d assertions passed, %d failed\n", p, f}' /tmp/_t1 /tmp/_t2 /tmp/_t3 /tmp/_t4
rm -f /tmp/_t1 /tmp/_t2 /tmp/_t3 /tmp/_t4
