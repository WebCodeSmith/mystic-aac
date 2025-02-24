"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
    content: [
        './src/**/*.{js,ts,jsx,tsx,ejs}',
        './views/**/*.ejs'
    ],
    theme: {
        extend: {
            dropShadow: {
                'glow-gold': '0 0 5px rgba(255, 215, 0, 0.5)',
                'glow-silver': '0 0 5px rgba(192, 192, 192, 0.5)',
                'glow-bronze': '0 0 5px rgba(205, 127, 50, 0.5)',
            },
            colors: {
                'primary': '#e0c9a6',
                'secondary': '#5c4033',
                'accent': '#8b6b5f',
            },
            backgroundColor: {
                'surface': 'rgba(0, 0, 0, 0.8)',
            },
        },
    },
    plugins: [],
};
exports.default = config;
