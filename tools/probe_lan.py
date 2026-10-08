#!/usr/bin/env python3
"""Cherche les contrôleurs LED Wi-Fi du réseau : Magic Home (48899), Tuya (6666/6667), Govee, mDNS, SSDP."""
import socket, time, threading, json, struct, sys
res = {}
def log(k, v):
    res.setdefault(k, []).append(v); print(k, v, flush=True)

def listen(port, tag, dur=12):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try: s.bind(("", port))
    except Exception as e: print(tag, "bind fail", e); return
    s.settimeout(1); end = time.time()+dur
    seen=set()
    while time.time()<end:
        try:
            d,a = s.recvfrom(4096)
            key=(a[0],len(d))
            if key in seen: continue
            seen.add(key); log(tag, (a[0], len(d), d[:40].hex()))
        except socket.timeout: pass

def magichome():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1); s.settimeout(1)
    for _ in range(3):
        s.sendto(b"HF-A11ASSISTHREAD", ("255.255.255.255", 48899))
        end=time.time()+2
        while time.time()<end:
            try:
                d,a=s.recvfrom(1024); 
                if d!=b"HF-A11ASSISTHREAD": log("magichome",(a[0],d.decode(errors='replace')))
            except socket.timeout: pass

def govee():
    r = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    r.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try: r.bind(("",4002))
    except Exception as e: print("govee bind", e); return
    r.settimeout(1)
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
    s.sendto(json.dumps({"msg":{"cmd":"scan","data":{"account_topic":"reserve"}}}).encode(), ("239.255.255.250",4001))
    end=time.time()+5
    while time.time()<end:
        try: d,a=r.recvfrom(2048); log("govee",(a[0],d.decode(errors='replace')))
        except socket.timeout: pass

def mdns():
    import random
    def q(name):
        hdr=struct.pack(">HHHHHH",0,0,1,0,0,0)
        qn=b"".join(bytes([len(p)])+p.encode() for p in name.split("."))+b"\0"
        return hdr+qn+struct.pack(">HH",12,1)
    s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(1)
    for n in ["_services._dns-sd._udp.local","_wled._tcp.local","_http._tcp.local","_hap._tcp.local","_esphomelib._tcp.local"]:
        s.sendto(q(n),("224.0.0.251",5353))
    end=time.time()+4; seen=set()
    while time.time()<end:
        try:
            d,a=s.recvfrom(4096)
            txt=d.decode('latin1'); 
            import re
            names=set(re.findall(r'[A-Za-z0-9_\- ]{3,}', txt))
            k=(a[0],tuple(sorted(names))[:10])
            if k in seen: continue
            seen.add(k); log("mdns",(a[0],sorted(names)[:15]))
        except socket.timeout: pass

def ssdp():
    s=socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(1)
    m=b"M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n"
    s.sendto(m,("239.255.255.250",1900)); end=time.time()+4; seen=set()
    while time.time()<end:
        try:
            d,a=s.recvfrom(4096)
            srv=[l for l in d.decode(errors='replace').split("\r\n") if l.upper().startswith(("SERVER","ST:"))]
            k=(a[0],tuple(srv))
            if k not in seen: seen.add(k); log("ssdp",(a[0],srv))
        except socket.timeout: pass

ts=[threading.Thread(target=f) for f in (lambda: listen(6666,"tuya6666"), lambda: listen(6667,"tuya6667"), lambda: listen(7000,"tuya7000"), magichome, govee, mdns, ssdp)]
[t.start() for t in ts]; [t.join() for t in ts]
print("DONE", json.dumps({k:len(v) for k,v in res.items()}))
