import zlib, struct
def load(path):
    d = open(path,'rb').read(); i = 8; idat = b''; pal = None; trns = None
    while i < len(d):
        ln = struct.unpack('>I', d[i:i+4])[0]; typ = d[i+4:i+8]; dat = d[i+8:i+8+ln]
        if typ == b'IHDR': w,h,bd,ct,_,_,il = struct.unpack('>IIBBBBB', dat[:13])
        elif typ == b'PLTE': pal = dat
        elif typ == b'tRNS': trns = dat
        elif typ == b'IDAT': idat += dat
        i += 12 + ln
    raw = zlib.decompress(idat)
    ch = {0:1,2:3,3:1,4:2,6:4}[ct]
    bpp = max(1, ch*bd//8); stride = (w*ch*bd + 7)//8
    prev = bytearray(stride); rows = []
    for y in range(h):
        f = raw[y*(stride+1)]; line = bytearray(raw[y*(stride+1)+1:(y+1)*(stride+1)])
        for x in range(len(line)):
            a = line[x-bpp] if x>=bpp else 0; b = prev[x]; c = prev[x-bpp] if x>=bpp else 0
            if f==1: line[x]=(line[x]+a)&255
            elif f==2: line[x]=(line[x]+b)&255
            elif f==3: line[x]=(line[x]+(a+b)//2)&255
            elif f==4:
                pa,pb,pc = abs(b-c), abs(a-c), abs(a+b-2*c)
                pr = a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
                line[x]=(line[x]+pr)&255
        prev = line; rows.append(bytes(line))
    def px(x,y):
        r = rows[y]
        if ct==6: o=x*4; return (r[o],r[o+1],r[o+2],r[o+3])
        if ct==2: o=x*3; return (r[o],r[o+1],r[o+2],255)
        if ct==3:
            idx=r[x]; o=idx*3
            a = trns[idx] if trns and idx < len(trns) else 255
            return (pal[o],pal[o+1],pal[o+2],a)
        if ct==0: v=r[x]; return (v,v,v,255)
        if ct==4: o=x*2; return (r[o],r[o],r[o],r[o+1])
    return w,h,px
