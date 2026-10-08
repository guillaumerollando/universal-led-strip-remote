#!/usr/bin/env python3
"""Éteint 4 s puis rallume un ruban ELK-BLEDOM. Usage : ble_onoff.py <adresse> elk|melk (pip install bleak)."""
import asyncio, sys
from bleak import BleakScanner, BleakClient
W="0000fff3-0000-1000-8000-00805f9b34fb"; N="0000fff4-0000-1000-8000-00805f9b34fb"
addr=sys.argv[1]; variant=sys.argv[2]
B=lambda h: bytes.fromhex(h)
CMDS={"melk":{"init":["7e0783","7e0404"],"on":"7e0404f00001ff00ef","off":"7e0404000000ff00ef"},
      "elk": {"init":[],"on":"7e0004f00001ff00ef","off":"7e0004000000ff00ef"}}
async def main():
    d = await BleakScanner.find_device_by_address(addr, timeout=15)
    if not d: print("not found"); return
    for attempt in range(3):
        try:
            async with BleakClient(d, timeout=20) as c:
                await c.start_notify(N, lambda _,data: print("  notif", data.hex()))
                k=CMDS[variant]
                for i in k["init"]: await c.write_gatt_char(W,B(i),response=False); await asyncio.sleep(0.3)
                print("OFF"); await c.write_gatt_char(W,B(k["off"]),response=False); await asyncio.sleep(4)
                print("ON");  await c.write_gatt_char(W,B(k["on"]),response=False); await asyncio.sleep(2)
                print("ok"); return
        except Exception as e: print("retry", attempt, type(e).__name__, e)
asyncio.run(main())
