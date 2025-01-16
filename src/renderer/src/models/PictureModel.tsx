
import CharacterModel from "./CharacterModel";
import TagModel from "./TagModel";

export default interface PictureModel {
  id: string,
  tags: TagModel[],
  sfw: boolean,
  artist?: string,
  source?: string,
  characters: CharacterModel[]
}
