import AppRoutes from './AppRoutes'
import { ConfirmDialogProvider } from './components/ConfirmDialog/ConfirmDialogContext'

export default function App(): JSX.Element {
  return (
    <ConfirmDialogProvider>
      <AppRoutes />
    </ConfirmDialogProvider>
  )
}
