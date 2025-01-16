import Versions from './components/Versions'
import electronLogo from './assets/electron.svg'
import { useTranslation } from 'react-i18next'
import { NAME_SPACE } from './i18n'
import { Link } from 'react-router-dom'

export default function App(): JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')
  const { t } = useTranslation(NAME_SPACE.COMMON);

  return (
    <>
      <img alt="logo" className="logo" src={electronLogo} />
      <div className="creator">Powered by electron-vite</div>
      <div className="text">
        Build an Electron app with <span className="react">React</span>
        &nbsp;and <span className="ts">TypeScript</span>
      </div>
      <h1>{t('title')}</h1>
      <p className="tip">
        Please try pressing <code>F12</code> to open the devTool
      </p>
      <div className="actions">
        <div className="action">
          <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
        <div className="action">
          <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
            Send IPC
          </a>
        </div>
        <div className="action">
          <Link to="/pictures">
            Pictures
          </Link>
        </div>
      </div>
      <Versions />
    </>
  )
}
