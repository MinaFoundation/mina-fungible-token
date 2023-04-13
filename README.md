**Permissions**
send
receive
approve

**Transfer combinations**

_Receiving end of balance manipulation happens outside of a smart contract to ease interoperability_

- **From non-zkApp user, to non-zkApp user**

  - Transaction

  ```
  Token.transfer({
   from: user1.address,
   to: user2.address,
   amount
  })
  ```

- **From non-zkApp user, to zkApp (receive: none)**

  - Transaction

  ```
  // sub balance of user 'from'
  Token.transfer({
   from: user1.address,
   to: zkApp.address
   amount
  })
  ```

- **From non-zkApp user, to zkApp (receive: proof)**

  - Transaction

  ```
  // sub balance of user 'from'
  Token.transfer({
   from: user1.address,
   amount
  })
  ```

  - TokenHolder

    ```
    // sub balance of user 'from'
    Token.transfer({
    tp: zkApp.address,
    amount
    })
    ```

  - Transaction

- **From zkApp (send: proof), to non-zkApp user**

- **From zkApp (send: proof), to zkApp user (receive: none)**

- **From zkApp (send: proof), to zkApp user (receive: proof)**
