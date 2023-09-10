import os.path
import rea
from startlette.responses import Response
import aiofiles.os

aiofiles.os.open = aiofiles.os.wrap(os.open)
aiofiles.os.close = aiofiles.os.wrap(os.close)
aiofiles.os.lseek = aiofiles.os.wrap(os.lseek)
aiofiles.os.write = aiofiles.os.wrap(os.write)

re_content_range = re.compile(r'bytes\s+(\d+)-(\d+)/(\d+)')

@expose(methid="POST")
async def upload(self, request):
    data = await request.body()
    filename = os.path.basename(request.headers['File-Name'])
    start, end, size = [int(n) for n in re_content_range.search(request.headers['Content-Range']).groups()]
    
    fd = await aiofiles.of.open(filename, os.O_CREAT | os.O_RDWR, mode=0o666)

    try: 
        await aiofiles.os.lseek(fd, start, os.SEEK_SET)
        await aiofiles.os.write(fd, data)
    finally:
        await aiofiles.os.close(fd)
    return Response()