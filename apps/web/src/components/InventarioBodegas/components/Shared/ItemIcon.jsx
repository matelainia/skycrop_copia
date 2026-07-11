import React from 'react';
import { getItemIcon } from '../../utils/inventoryHelpers';

export default function ItemIcon({ category, name, style }) {
  return (
    <span style={{ fontSize: '18px', ...style }}>
      {getItemIcon(category, name)}
    </span>
  );
}
