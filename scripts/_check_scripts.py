import re,sys,subprocess,os
src=open('mojiworld_game.html',encoding='utf-8').read()
# match <script ...>...</script> capturing inner, skip ones with src=
blocks=re.findall(r'<script\b([^>]*)>(.*?)</script>',src,re.S)
tmp='/tmp/claude-0/-home-user-Mojiworld/1652515c-62db-56d2-8863-1459f775405a/scratchpad'
os.makedirs(tmp,exist_ok=True)
n=0;fail=0
for attrs,body in blocks:
    if 'src=' in attrs: continue
    if 'type=' in attrs and 'javascript' not in attrs and 'module' not in attrs: continue
    n+=1
    p=os.path.join(tmp,f'block_{n}.js')
    open(p,'w',encoding='utf-8').write(body)
    r=subprocess.run(['node','--check',p],capture_output=True,text=True)
    if r.returncode!=0:
        fail+=1
        print(f"BLOCK {n} ({len(body)} chars) FAIL:\n{r.stderr[:2000]}")
    else:
        print(f"BLOCK {n} ({len(body)} chars) OK")
print(f"\n{n} inline scripts, {fail} failed")
sys.exit(1 if fail else 0)
