import React from 'react'

const TransactionLayout = ({ children }) => {
  return (
    <div className="px-5">
        <h1 className="text-6xl font-bold gradient-title"></h1>
        {children}
    </div>
  )
};

export default TransactionLayout;