import { createRoot } from 'react-dom/client';
import { SearchWindow } from './SearchWindow.js';
import './index.css';

const root = createRoot(document.getElementById('root')!);
root.render(<SearchWindow />);
