from bs4 import BeautifulSoup

SCALE = 1.8033333333333332

def readsvg(filename):
    with open(filename) as fp:
        soup = BeautifulSoup(fp, features="xml")

    result = []
    boxes = soup.find('g', id='Mission-Boxes')
    for box in boxes.find_all('g', recursive=False):
        area_name = box.attrs.get('serif:id', box.attrs['id'])
        for rect in box.find_all('rect'):
            rect_id = rect.attrs.get('serif:id', rect.attrs['id'])
            x = float(rect.attrs['x'])
            y = float(rect.attrs['y'])
            w = float(rect.attrs['width'])
            h = float(rect.attrs['height'])
            xc = round((x+w/2.0)/SCALE)
            yc = round((y+h/2.0)/SCALE)
            name = area_name + '-' + rect_id
            result.append([name, xc, yc])

    return result

def print_list(data):
    print("const LAYOUT = {")
    for (name, x, y) in data:
        print(f'\t"{name}": [{x}, {y}],')
    print("}")

result = readsvg("tools/layout.svg")
print_list(result)
