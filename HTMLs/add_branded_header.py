"""
Script to add branded header to all HTML files in the project.
This adds the logo, title, and about modal to the top-right of each page.
"""

import os
import re

# HTML to insert after <body> tag
HEADER_HTML = '''    <!-- BRANDED HEADER -->
    <div class="branded-header" onclick="toggleAboutModal()">
        <img src="images/logic_gear_logo.png" alt="Logo">
        <div class="title">SITUATION ROOM</div>
    </div>

    <!-- ABOUT MODAL -->
    <div class="about-modal-overlay" id="about-modal" onclick="if(event.target === this) toggleAboutModal()">
        <div class="about-modal">
            <h2>SITUATION ROOM</h2>
            <div class="version">VERSION 0.50 (BETA)</div>
            
            <div class="section">
                <div class="section-title">Project Repository</div>
                <div class="section-content">
                    <a href="https://github.com/yourusername/projectimages" target="_blank" rel="noopener noreferrer">
                        github.com/yourusername/projectimages
                    </a>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Open Source & Free Software</div>
                <div class="section-content">
                    This project is open source and free software. You are free to use, modify, and distribute it under the terms of the applicable license. We believe in the power of open collaboration and transparent education technology.
                </div>
            </div>

            <div class="section">
                <div class="section-title">Credits</div>
                <div class="section-content">
                    Created and developed by <strong>David Waugh</strong>.<br>
                    For inquiries, please visit the GitHub repository.
                </div>
            </div>

            <button class="close-btn" onclick="toggleAboutModal()">Close</button>
        </div>
    </div>

'''

# JavaScript function to add
JS_FUNCTION = '''
        function toggleAboutModal() {
            const modal = document.getElementById('about-modal');
            modal.classList.toggle('active');
        }
'''

# CSS styles to add before </style>
CSS_STYLES = '''
        /* --- BRANDED HEADER --- */
        .branded-header {
            position: fixed;
            top: 20px;
            right: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 18px;
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #0a2a2a;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.3s ease;
            z-index: 9999;
            backdrop-filter: blur(10px);
        }

        .branded-header:hover {
            border-color: #00ffcc;
            background: rgba(0, 255, 204, 0.05);
            box-shadow: 0 0 20px rgba(0, 255, 204, 0.2);
        }

        .branded-header img {
            width: 32px;
            height: 32px;
            filter: brightness(0) invert(1);
            opacity: 0.9;
        }

        .branded-header .title {
            font-family: 'Oswald', sans-serif;
            font-size: 0.9rem;
            color: #00ffcc;
            letter-spacing: 3px;
            font-weight: 700;
            text-transform: uppercase;
        }

        /* --- ABOUT MODAL --- */
        .about-modal-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 10000;
            align-items: center;
            justify-content: center;
        }

        .about-modal-overlay.active {
            display: flex;
        }

        .about-modal {
            background: #0a0a0a;
            border: 2px solid #00ffcc;
            border-radius: 8px;
            padding: 40px;
            max-width: 600px;
            width: 90%;
            box-shadow: 0 0 40px rgba(0, 255, 204, 0.3);
        }

        .about-modal h2 {
            font-family: 'Oswald', sans-serif;
            font-size: 2rem;
            color: #00ffcc;
            letter-spacing: 5px;
            text-align: center;
            margin-bottom: 10px;
        }

        .about-modal .version {
            text-align: center;
            font-size: 0.8rem;
            color: #666;
            letter-spacing: 2px;
            margin-bottom: 30px;
        }

        .about-modal .section {
            margin-bottom: 25px;
            padding-bottom: 25px;
            border-bottom: 1px solid #222;
        }

        .about-modal .section:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }

        .about-modal .section-title {
            font-family: 'Oswald', sans-serif;
            font-size: 0.9rem;
            color: #00ffcc;
            letter-spacing: 2px;
            margin-bottom: 10px;
            text-transform: uppercase;
        }

        .about-modal .section-content {
            font-size: 0.85rem;
            color: #ccc;
            line-height: 1.6;
        }

        .about-modal a {
            color: #00ffcc;
            text-decoration: none;
            transition: all 0.2s ease;
        }

        .about-modal a:hover {
            color: #00ff88;
            text-decoration: underline;
        }

        .about-modal .close-btn {
            display: block;
            margin: 30px auto 0;
            padding: 12px 30px;
            background: transparent;
            border: 1px solid #00ffcc;
            color: #00ffcc;
            font-family: 'Oswald', sans-serif;
            font-size: 0.8rem;
            letter-spacing: 2px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
        }

        .about-modal .close-btn:hover {
            background: #00ffcc;
            color: #000;
        }
'''

def add_branded_header(filepath):
    """Add branded header to a single HTML file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if already added
    if 'branded-header' in content:
        print(f"✓ {os.path.basename(filepath)} - Already has branded header")
        return False
    
    # Add CSS styles before </style>
    content = content.replace('    </style>', CSS_STYLES + '\n    </style>')
    
    # Add HTML after <body>
    content = content.replace('<body>', '<body>\n' + HEADER_HTML)
    
    # Add JavaScript function (find a good spot - after other functions)
    # Look for a function definition pattern
    match = re.search(r'(function \w+\(\) \{[^}]+\})\s*\n', content)
    if match:
        insert_pos = match.end()
        content = content[:insert_pos] + JS_FUNCTION + '\n' + content[insert_pos:]
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"✓ {os.path.basename(filepath)} - Added branded header")
    return True

def main():
    """Add branded header to all main HTML files."""
    html_dir = r"\\mycloudex2ultra\dwaugh\Antigravity\simroom\Github Repos\projectimages\HTMLs"
    
    # Main files to update
    files_to_update = [
        'teachermode.html',
        'simroom.html',
        'index.html',
        'blobhospital.html',
        'projector.html'
    ]
    
    updated_count = 0
    for filename in files_to_update:
        filepath = os.path.join(html_dir, filename)
        if os.path.exists(filepath):
            if add_branded_header(filepath):
                updated_count += 1
        else:
            print(f"✗ {filename} - File not found")
    
    print(f"\n{updated_count} files updated successfully!")

if __name__ == '__main__':
    main()
