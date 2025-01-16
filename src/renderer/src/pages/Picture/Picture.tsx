import PictureModel from '@renderer/models/PictureModel'
import img from '../../assets/herrscher_mei_awaken.gif'

export default function Picture({ tags }: PictureModel): JSX.Element {
  return (
    <>
      <ul className="tags">
        {tags.map((tag) => (
          <li key={tag.id} className="tag">
            <p>{tag.name}</p>
          </li>
        ))}
      </ul>
      <img alt="picture" className="picture" src={img} width={200} />
    </>
  )
}
