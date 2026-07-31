import { useTranslation } from 'react-i18next'
import './Pagination.css'

interface PaginationProps {
  /** 0-based current page index. */
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="pagination">
      <button
        type="button"
        className="btn"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
      >
        {t('gallery.pagination.previous')}
      </button>
      <span>{t('gallery.pagination.page', { page: page + 1, total: totalPages })}</span>
      <button
        type="button"
        className="btn"
        disabled={page + 1 >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('gallery.pagination.next')}
      </button>
    </div>
  )
}
