from bs4 import BeautifulSoup

SCALE = 1.8

def readsvg(filename):
	with open(filename) as fp:
		soup = BeautifulSoup(fp, features="xml")

	result = []
	boxes = soup.find('g', id='Mission-Boxes')
	for box in boxes.find_all('g', recursive=False):
		area_name = box.attrs.get('serif:id', box.attrs['id'])
		for g in box.find_all('g'):
			xo = 0
			yo = 0
			transform = g.attrs.get('transform')
			if transform and transform.startswith("translate("):
				transform = transform.replace("translate(","").replace(")","").split(',')
				xo = float(transform[0])
				yo = float(transform[1])
			for rect in g.find_all('rect'):
				rect_id = rect.attrs.get('serif:id', rect.attrs['id'])
				x = float(rect.attrs['x']) + xo
				y = float(rect.attrs['y']) + yo
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
