import React from 'react';
import { CURRENCIES } from '../../utils/currency';

const CurrencySelect = ({ value, onChange, name = 'currency', id = 'currency' }) => (
  <select id={id} name={name} className="form-input" value={value || 'INR'} onChange={onChange}>
    {CURRENCIES.map((c) => (
      <option key={c} value={c}>{c}</option>
    ))}
  </select>
);

export default CurrencySelect;
