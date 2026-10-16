import { render } from 'preact';
import { App } from './ui/App';
import { bootstrap } from './ui/store';
import './styles/app.css';

render(<App />, document.getElementById('app')!);
void bootstrap();
