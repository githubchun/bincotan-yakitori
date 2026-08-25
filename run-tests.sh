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
# Capture rather than pipe: a pipeline reports tee's exit status, so a file that
# THREW instead of failing an assertion used to print nothing and still be
# counted as a clean pass.
N=0
sect() {
  N=$((N + 1)); title=$1; shift
  echo "── $title ──"
  if run "$@" > "/tmp/_t$N" 2>&1; then cat "/tmp/_t$N"; else
    cat "/tmp/_t$N"; echo "  ✗ $title failed or threw — stopping here"; exit 1
  fi
}

sect "pricing + validation" assets/js/menu-data.js assets/js/pricing.js test.js
echo
sect "transaction record" assets/js/menu-data.js assets/js/pricing.js assets/js/ledger.js test-ledger.js
echo
sect "documentation claims" assets/js/menu-data.js assets/js/pricing.js assets/js/ledger.js assets/js/store.js test-docs.js
echo
sect "booking lifecycle" assets/js/menu-data.js assets/js/pricing.js assets/js/ledger.js assets/js/store.js test-flow.js

echo
echo "════════════════════════════════════════"
awk '/passed,/ {p+=$1; f+=$3} END {printf "  %d assertions passed, %d failed\n", p, f}' /tmp/_t1 /tmp/_t2 /tmp/_t3 /tmp/_t4
rm -f /tmp/_t1 /tmp/_t2 /tmp/_t3 /tmp/_t4
