import PictureModel from '@renderer/models/PictureModel';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Picture from './Picture';

const PicturePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [picture, setPicture] = useState<PictureModel | null>(null);

  let sureId: string = id ?? '';

  useEffect(() => {
    // Simulate fetching picture data
    const fetchPicture = async () => {
      // Replace this with actual data fetching logic
      const pictureData: PictureModel = {
        id: sureId,
        sfw: true,
        characters: [{ name: 'name', aliases: ['alias1', 'alias2'], series: 'series', id: '1' }, { name: 'name2', aliases: ['alias3', 'alias4'], series: 'series2', id: '2' }],
        tags: [{ name: 'tag1', id: '1' }, { name: 'tag2', id: '2' }],
      };
      setPicture(pictureData);
    };

    fetchPicture();
  }, [id]);

  if (!picture) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <Picture {...picture} />
    </div>
  );
};

export default PicturePage;
