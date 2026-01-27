
import re
import sys

def check_balance(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Simple regex for tags
    tags = re.findall(r'<(/?[a-zA-Z0-9\.]+)', content)
    
    stack = []
    for tag in tags:
        if tag.startswith('/'):
            if not stack:
                print(f"Error: Closing tag {tag} with empty stack")
                continue
            last = stack.pop()
            if last != tag[1:]:
                print(f"Error: Mismatch! Started <{last}>, ended with </{tag[1:]}>")
        else:
            # Skip self-closing tags (this regex is too simple for that, let's refine)
            pass

    # Better approach: find all <tag and all /> or </tag
    # This is hard with regex...
    
    # Let's just count common tags
    for t in ['Row', 'Col', 'Card', 'div', 'Tooltip', 'Text', 'Title', 'Space', 'Divider', 'Tag', 'Badge', 'Alert', 'Modal']:
        open_count = content.count(f'<{t}')
        close_count = content.count(f'</{t}>') + content.count(f'</{t} >')
        # Check for self-closing
        self_close = content.count(f'<{t}') - content.count(f'<{t}>') - content.count(f'<{t} ') # not quite
        
        print(f"{t}: {open_count} open, {close_count} close")

if __name__ == "__main__":
    check_balance(sys.argv[1])
